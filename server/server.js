const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Allow socket connections from the configured client origin (or anything in dev)
const clientOrigin = process.env.CLIENT_ORIGIN || '*';
const io = socketIo(server, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 25 * 1024 * 1024 // 25MB for large file uploads
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Helper: generate unique friend code
const generateFriendCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  fullName: { type: String },
  age: { type: Number },
  hometown: { type: String },
  avatar: { type: String }, // data URL or image URL
  friendCode: { type: String, unique: true, sparse: true },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  room: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'audio', 'image', 'video', 'file'], default: 'text' },
  duration: { type: Number }, // for audio
  fileName: { type: String },
  mimeType: { type: String },
  fileSize: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  description: String,
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  joinCode: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
});

const directMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'audio', 'image', 'video', 'file'], default: 'text' },
  duration: { type: Number }, // for audio
  fileName: { type: String },
  mimeType: { type: String },
  fileSize: { type: Number },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  hiddenFor: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Room = mongoose.model('Room', roomSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);

// Store online users
const onlineUsers = new Map();

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // User joins (requires existing userId)
  socket.on('user_join', async (data, callback) => {
    try {
      const { userId } = data;
      if (!userId) {
        if (typeof callback === 'function') callback({ error: 'missing_user' });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        if (typeof callback === 'function') callback({ error: 'user_not_found' });
        return;
      }

      const username = user.username;
      user.lastSeen = new Date();
      await user.save();
      onlineUsers.set(socket.id, { username, userId: user._id.toString(), socketId: socket.id, avatar: user.avatar || null, lastSeen: user.lastSeen });
      io.emit('users_online', Array.from(onlineUsers.values()));
      socket.emit('connection_success', { message: 'Connected to server', userId });
      if (typeof callback === 'function') callback({ userId });
    } catch (err) {
      console.log('Error on user_join:', err);
      if (typeof callback === 'function') callback({ error: 'user_join_failed' });
    }
  });

  // Join room (with ack)
  socket.on('join_room', (data, callback) => {
    try {
      const { room } = data || {};
      if (!room) return;
      socket.join(room);
      const user = onlineUsers.get(socket.id);
      // Notify others in the room
      socket.to(room).emit('user_joined', {
        message: `${user?.username || 'Someone'} joined ${room}`
      });
      // Acknowledge to the requester
      if (typeof callback === 'function') callback({ ok: true, room });
      socket.emit('joined_room', { room });
      console.log('[socket] joined_room', socket.id, room);
    } catch (err) {
      if (typeof callback === 'function') callback({ ok: false });
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    const { content, room, sender, senderName, tempId, type, duration, fileName, mimeType, fileSize } = data;

    try {
      
      if (!sender) {
        console.error('[SEND_MSG] ERROR: sender ID is missing!');
        return;
      }

      // Verify user is a member of the room
      const roomDoc = await Room.findOne({ name: room });
      if (!roomDoc) {
        console.error('[SEND_MSG] ERROR: Room not found:', room);
        socket.emit('message_error', { error: 'Room not found', tempId });
        return;
      }
      
      if (!roomDoc.members.some(m => m.toString() === sender)) {
        console.error('[SEND_MSG] ERROR: User not a member of room:', sender, room);
        socket.emit('message_error', { error: 'Not a member of this room', tempId });
        return;
      }

      // Save message to database (sender should be a valid ObjectId string)
      const newMessage = new Message({
        sender,
        senderName,
        room,
        content,
        type: type || 'text',
        duration: duration || undefined,
        fileName: fileName || undefined,
        mimeType: mimeType || undefined,
        fileSize: fileSize || undefined
      });
      await newMessage.save();

      const msgPayload = {
        _id: newMessage._id,
        sender: newMessage.sender,
        senderName: newMessage.senderName,
        room: newMessage.room,
        content: newMessage.content,
        type: newMessage.type,
        duration: newMessage.duration,
        fileName: newMessage.fileName,
        mimeType: newMessage.mimeType,
        fileSize: newMessage.fileSize,
        timestamp: newMessage.timestamp
      };

      // Attach client tempId if provided so client can reconcile optimistic UI
      if (tempId) msgPayload.tempId = tempId;

      // Send to the sender first, then broadcast to others in the room
      socket.emit('receive_message', msgPayload);
      socket.to(room).emit('receive_message', msgPayload);
    } catch (error) {
      console.error('[SEND_MSG] Error saving message:', error);
    }
  });

  // Leave room
  socket.on('leave_room', (data) => {
    const { room } = data;
    socket.leave(room);
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.to(room).emit('user_left', {
        message: `${user.username} left ${room}`
      });
    }
  });

  // Typing indicator in rooms
  socket.on('typing', (data) => {
    const { room, userId, username, isTyping } = data || {};
    if (!room) return;
    socket.to(room).emit('typing', { room, userId, username, isTyping });
  });

  // Handle DM sending (respect block lists)
  socket.on('send_dm', async (data) => {
    const { senderId, senderName, receiverId, content, tempId, type, duration, fileName, mimeType, fileSize } = data;

    try {
      const sender = await User.findById(senderId);
      const receiver = await User.findById(receiverId);
      if (!sender || !receiver) return;

      const senderBlockedReceiver = (sender.blocked || []).some(id => id.toString() === receiverId);
      const receiverBlockedSender = (receiver.blocked || []).some(id => id.toString() === senderId);
      if (senderBlockedReceiver || receiverBlockedSender) {
        // Do not broadcast if blocked
        return;
      }

      // Create message object for broadcast
      const message = {
        tempId,
        sender: { _id: senderId, username: senderName },
        senderName: senderName,
        receiver: receiverId,
        content: content,
        type: type || 'text',
        duration: duration || undefined,
        fileName: fileName || undefined,
        mimeType: mimeType || undefined,
        fileSize: fileSize || undefined,
        timestamp: new Date()
      };

      // Find receiver's socket and deliver immediately
      let found = false;
      for (const [socketId, user] of onlineUsers.entries()) {
        if (user.userId === receiverId) {
          io.to(socketId).emit('receive_dm', { message });
          found = true;
          break;
        }
      }
      
      // Also emit back to sender so they see their own message
      for (const [socketId, user] of onlineUsers.entries()) {
        if (user.userId === senderId) {
          io.to(socketId).emit('receive_dm', { message });
          break;
        }
      }
      
      if (!found) {
        // Receiver not online; no broadcast
      }
    } catch (err) {
      console.error('[socket send_dm] error:', err);
    }
  });

  // Typing indicator in DMs
  socket.on('typing_dm', (data) => {
    const { toUserId, fromUserId, username, isTyping } = data || {};
    if (!toUserId) return;
    for (const [socketId, user] of onlineUsers.entries()) {
      if (user.userId === toUserId) {
        io.to(socketId).emit('typing_dm', { toUserId, fromUserId, username, isTyping });
        break;
      }
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      try {
        await User.findByIdAndUpdate(user.userId, { lastSeen: new Date() });
      } catch (err) {
        console.error('Error updating lastSeen:', err);
      }
      onlineUsers.delete(socket.id);
      io.emit('users_online', Array.from(onlineUsers.values()));
    }
  });
});

// REST API Routes
app.get('/api/messages/:room', async (req, res) => {
  try {
    const { userId } = req.query;
    const room = await Room.findOne({ name: req.params.room });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if user is a member - if not, deny access
    if (userId && !room.members.some(m => m.toString() === userId)) {
      console.log(`[API] User ${userId} is not a member of room ${room.name}`);
      return res.status(403).json({ error: 'Not a member of this room' });
    }
    
    const messages = await Message.find({ room: req.params.room })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    // Reverse to get chronological order (oldest first)
    const messagesChronological = messages.reverse();
    res.json(messagesChronological);
  } catch (error) {
    console.error('[API] Error fetching messages:', error);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

// Auth: register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email_password_username_required' });
    }

    const emailLower = String(email).trim().toLowerCase();
    const usernameTrim = String(username).trim();
    const pass = String(password);
    const hasLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /\d/.test(pass);
    if (!(hasLength && hasUpper && hasNumber)) {
      return res.status(400).json({ error: 'password_requirements', detail: 'Min 8 chars, 1 uppercase, 1 number' });
    }

    const emailExists = await User.findOne({ email: emailLower });
    if (emailExists) return res.status(409).json({ error: 'email_in_use' });

    const usernameExists = await User.findOne({ username: usernameTrim });
    if (usernameExists) return res.status(409).json({ error: 'username_in_use' });

    const hashed = await bcrypt.hash(pass, 10);
    let friendCode;
    let codeExists = true;
    while (codeExists) {
      friendCode = generateFriendCode();
      codeExists = await User.findOne({ friendCode });
    }
    const user = await User.create({ email: emailLower, password: hashed, username: usernameTrim, friendCode });

    res.status(201).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar || null,
        fullName: user.fullName || '',
        age: user.age || null,
        hometown: user.hometown || '',
        friendCode: user.friendCode
      }
    });
  } catch (error) {
    console.log('Register error:', error);
    res.status(500).json({ error: 'register_failed' });
  }
});

// Auth: login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email_password_required' });
    }
    const emailLower = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailLower });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar || null,
        fullName: user.fullName || '',
        age: user.age || null,
        hometown: user.hometown || '',
        friendCode: user.friendCode
      }
    });
  } catch (error) {
    console.log('Login error:', error);
    res.status(500).json({ error: 'login_failed' });
  }
});

// Friend Routes - MUST come before /api/users/:id since :id is a catch-all parameter
app.get('/api/users/search', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code_required' });
    
    const user = await User.findOne({ friendCode: code.toUpperCase() });
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    
    const populatedUser = await User.findById(user._id).populate('friends');
    
    res.json({
      user: {
        id: populatedUser._id.toString(),
        username: populatedUser.username,
        avatar: populatedUser.avatar || null,
        friendCode: populatedUser.friendCode,
        friendsCount: populatedUser.friends ? populatedUser.friends.length : 0
      }
    });
  } catch (error) {
    console.error('[SEARCH] Error:', error);
    res.status(500).json({ error: 'Error searching user' });
  }
});

// Get user profile (excluding password)
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Update user profile (no auth for now)
app.put('/api/users/:id', async (req, res) => {
  try {
    const updates = {};
    const allowed = ['fullName', 'age', 'hometown', 'email', 'avatar'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Remove avatar
app.delete('/api/users/:id/avatar', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $unset: { avatar: '' } }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error removing avatar' });
  }
});

app.post('/api/friends/request', async (req, res) => {
  try {
    const { toUserId, fromUserId } = req.body;
    if (!toUserId || !fromUserId) {
      return res.status(400).json({ error: 'toUserId_fromUserId_required' });
    }
    if (toUserId === fromUserId) {
      return res.status(400).json({ error: 'cannot_add_self' });
    }
    const toUser = await User.findById(toUserId);
    const fromUser = await User.findById(fromUserId);
    if (!toUser || !fromUser) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    // Disallow requests if either user has blocked the other
    if (toUser.blocked?.some(id => id.toString() === fromUserId) || fromUser.blocked?.some(id => id.toString() === toUserId)) {
      return res.status(403).json({ error: 'blocked' });
    }
    // Check if already friends
    if (toUser.friends?.includes(fromUserId)) {
      return res.status(409).json({ error: 'already_friends' });
    }
    // Check if request already exists
    const existing = await FriendRequest.findOne({
      from: fromUserId,
      to: toUserId,
      status: 'pending'
    });
    if (existing) {
      return res.status(409).json({ error: 'request_already_sent' });
    }
    const friendReq = await FriendRequest.create({ from: fromUserId, to: toUserId });
    res.status(201).json(friendReq);
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Error sending friend request' });
  }
});

app.post('/api/friends/accept', async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId_required' });
    const friendReq = await FriendRequest.findById(requestId);
    if (!friendReq) return res.status(404).json({ error: 'request_not_found' });
    if (friendReq.status !== 'pending') {
      return res.status(400).json({ error: 'request_not_pending' });
    }
    const fromUser = await User.findById(friendReq.from);
    const toUser = await User.findById(friendReq.to);
    if (!fromUser || !toUser) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    // Add each other to friends array
    if (!fromUser.friends.includes(friendReq.to)) {
      fromUser.friends.push(friendReq.to);
    }
    if (!toUser.friends.includes(friendReq.from)) {
      toUser.friends.push(friendReq.from);
    }
    friendReq.status = 'accepted';
    await fromUser.save();
    await toUser.save();
    await friendReq.save();
    res.json({ message: 'Request accepted', friendRequest: friendReq });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Error accepting request' });
  }
});

app.post('/api/friends/reject', async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId_required' });
    const friendReq = await FriendRequest.findById(requestId);
    if (!friendReq) return res.status(404).json({ error: 'request_not_found' });
    if (friendReq.status !== 'pending') {
      return res.status(400).json({ error: 'request_not_pending' });
    }
    friendReq.status = 'rejected';
    await friendReq.save();
    res.json({ message: 'Request rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Error rejecting request' });
  }
});

app.get('/api/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate({ path: 'friends', select: 'username avatar friendCode', options: { lean: true } })
      .lean();
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const incomingRequests = await FriendRequest.find({ to: userId, status: 'pending' })
      .populate({ path: 'from', select: 'username avatar friendCode', options: { lean: true } })
      .lean();
    const outgoingRequests = await FriendRequest.find({ from: userId, status: 'pending' })
      .populate({ path: 'to', select: 'username avatar friendCode', options: { lean: true } })
      .lean();
    res.json({
      friends: user.friends || [],
      incomingRequests,
      outgoingRequests
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching friends' });
  }
});

app.delete('/api/friends/:userId/:friendId', async (req, res) => {
  try {
    const { userId, friendId } = req.params;
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);
    if (!user || !friend) return res.status(404).json({ error: 'user_not_found' });
    user.friends = user.friends.filter(id => id.toString() !== friendId);
    friend.friends = friend.friends.filter(id => id.toString() !== userId);
    await user.save();
    await friend.save();
    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing friend' });
  }
});

// Block a user (also removes friendship if present)
app.post('/api/friends/block', async (req, res) => {
  try {
    const { userId, targetId } = req.body || {};
    if (!userId || !targetId) return res.status(400).json({ error: 'userId_targetId_required' });

    const user = await User.findById(userId);
    const target = await User.findById(targetId);
    if (!user || !target) return res.status(404).json({ error: 'user_not_found' });

    // Add to blocked list
    if (!user.blocked.some(id => id.toString() === targetId)) {
      user.blocked.push(targetId);
    }

    // Remove friendship both ways if exists
    user.friends = (user.friends || []).filter(id => id.toString() !== targetId);
    target.friends = (target.friends || []).filter(id => id.toString() !== userId);

    await user.save();
    await target.save();
    res.json({ message: 'Blocked', blockedId: targetId });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Error blocking user' });
  }
});

// Unblock a user
app.post('/api/friends/unblock', async (req, res) => {
  try {
    const { userId, targetId } = req.body || {};
    if (!userId || !targetId) return res.status(400).json({ error: 'userId_targetId_required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    user.blocked = (user.blocked || []).filter(id => id.toString() !== targetId);
    await user.save();
    res.json({ message: 'Unblocked', unblockedId: targetId });
  } catch (error) {
    console.error('Unblock error:', error);
    res.status(500).json({ error: 'Error unblocking user' });
  }
});

// Get blocked users
app.get('/api/friends/blocked/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate({ path: 'blocked', select: 'username avatar friendCode', options: { lean: true } })
      .lean();
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    res.json(user.blocked || []);
  } catch (error) {
    console.error('Get blocked error:', error);
    res.status(500).json({ error: 'Error fetching blocked users' });
  }
});

// Direct Message Routes
// Get DM conversations list for a user
app.get('/api/dm/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find all DMs where user is sender or receiver, excluding ones hidden for this user
    const messages = await DirectMessage.find({
      $or: [{ sender: userId }, { receiver: userId }],
      hiddenFor: { $ne: userId }
    }).populate('sender receiver', 'username avatar').sort({ timestamp: -1 });
    
    // Group by conversation partner and get last visible message
    const conversationsMap = new Map();
    messages.forEach(msg => {
      const partnerId = msg.sender._id.toString() === userId ? msg.receiver._id.toString() : msg.sender._id.toString();
      if (!conversationsMap.has(partnerId)) {
        const partner = msg.sender._id.toString() === userId ? msg.receiver : msg.sender;
        conversationsMap.set(partnerId, {
          userId: partner._id,
          username: partner.username,
          avatar: partner.avatar,
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp
        });
      }
    });
    
    res.json(Array.from(conversationsMap.values()));
  } catch (error) {
    console.error('Error fetching DM conversations:', error);
    res.status(500).json({ error: 'Error fetching conversations' });
  }
});

// Get DM messages between two users (excluding ones hidden for requester)
app.get('/api/dm/messages/:userId/:partnerId', async (req, res) => {
  try {
    const { userId, partnerId } = req.params;
    
    const messages = await DirectMessage.find({
      $and: [
        {
          $or: [
            { sender: userId, receiver: partnerId },
            { sender: partnerId, receiver: userId }
          ]
        },
        { hiddenFor: { $ne: userId } }
      ]
    }).populate('sender', 'username avatar').sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching DM messages:', error);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

// Send a DM
app.post('/api/dm/send', async (req, res) => {
  try {
    const { senderId, receiverId, content, type, duration, fileName, mimeType, fileSize, tempId } = req.body;
    
    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }
    // Prevent sending if either side has blocked the other
    const senderBlockedReceiver = (sender.blocked || []).some(id => id.toString() === receiverId);
    const receiverBlockedSender = (receiver.blocked || []).some(id => id.toString() === senderId);
    if (senderBlockedReceiver || receiverBlockedSender) {
      return res.status(403).json({ error: 'blocked' });
    }
    
    const dm = new DirectMessage({
      sender: senderId,
      senderName: sender.username,
      receiver: receiverId,
      content,
      type: type || 'text',
      duration: duration || undefined,
      fileName: fileName || undefined,
      mimeType: mimeType || undefined,
      fileSize: fileSize || undefined,
      timestamp: new Date()
    });
    
    await dm.save();
    const populated = await DirectMessage.findById(dm._id).populate('sender receiver', 'username avatar');

    if (!populated) {
      console.error('[DM send] Could not retrieve saved message');
      return res.status(500).json({ error: 'Failed to save message' });
    }

    // Broadcast to receiver if online, include tempId for client dedupe
    const payload = { ...populated.toObject(), tempId: tempId || undefined };
    console.log('[DM send] Broadcasting to receiver:', receiverId, 'type:', type, 'size:', fileSize);
    for (const [socketId, user] of onlineUsers.entries()) {
      if (user.userId === receiverId) {
        io.to(socketId).emit('receive_dm', { message: payload });
        console.log('[DM send] Sent to receiver socket:', socketId);
        break;
      }
    }
    
    // Also emit back to sender so they see their own message
    for (const [socketId, user] of onlineUsers.entries()) {
      if (user.userId === senderId) {
        io.to(socketId).emit('receive_dm', { message: payload });
        console.log('[DM send] Sent to sender socket:', socketId);
        break;
      }
    }

    res.json(payload);
  } catch (error) {
    console.error('Error sending DM:', error);
    res.status(500).json({ error: 'Error sending message', details: error.message });
  }
});

// Send room message via REST (for large attachments)
app.post('/api/rooms/send-message', async (req, res) => {
  try {
    const { room, sender, senderName, content, type, duration, fileName, mimeType, fileSize, tempId } = req.body;
    
    if (!room || !sender || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify user is a member of the room
    const roomDoc = await Room.findOne({ name: room });
    if (!roomDoc) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (!roomDoc.members.some(m => m.toString() === sender)) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    // Save message to database
    const newMessage = new Message({
      sender,
      senderName,
      room,
      content,
      type: type || 'text',
      duration: duration || undefined,
      fileName: fileName || undefined,
      mimeType: mimeType || undefined,
      fileSize: fileSize || undefined
    });
    await newMessage.save();

    const msgPayload = {
      _id: newMessage._id,
      sender: newMessage.sender,
      senderName: newMessage.senderName,
      room: newMessage.room,
      content: newMessage.content,
      type: newMessage.type,
      duration: newMessage.duration,
      fileName: newMessage.fileName,
      mimeType: newMessage.mimeType,
      fileSize: newMessage.fileSize,
      timestamp: newMessage.timestamp,
      tempId: tempId || undefined
    };

    // Broadcast to all users in the room
    io.to(room).emit('receive_message', msgPayload);
    
    console.log('[Room message REST] Sent message to room:', room, 'type:', type, 'size:', fileSize);
    res.json(msgPayload);
  } catch (error) {
    console.error('Error sending room message:', error);
    res.status(500).json({ error: 'Error sending message', details: error.message });
  }
});

// Delete entire conversation (self-hide or delete for both)
app.delete('/api/dm/conversation/:userId/:partnerId', async (req, res) => {
  try {
    const { userId, partnerId } = req.params;
    const scope = req.query.scope === 'both' ? 'both' : 'self';

    if (scope === 'both') {
      const result = await DirectMessage.deleteMany({
        $or: [
          { sender: userId, receiver: partnerId },
          { sender: partnerId, receiver: userId }
        ]
      });
      return res.json({ deleted: result.deletedCount || 0 });
    }

    const result = await DirectMessage.updateMany({
      $or: [
        { sender: userId, receiver: partnerId },
        { sender: partnerId, receiver: userId }
      ],
      hiddenFor: { $ne: userId }
    }, { $addToSet: { hiddenFor: userId } });

    res.json({ hidden: result.modifiedCount || 0 });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Error deleting conversation' });
  }
});

// Delete specific messages (self-hide or delete for both)
app.post('/api/dm/deleteMessages', async (req, res) => {
  try {
    const { userId, messageIds, scope } = req.body || {};
    if (!userId || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'userId_and_messageIds_required' });
    }

    if (scope === 'both') {
      const result = await DirectMessage.deleteMany({ _id: { $in: messageIds } });
      return res.json({ deleted: result.deletedCount || 0 });
    }

    const result = await DirectMessage.updateMany({
      _id: { $in: messageIds },
      hiddenFor: { $ne: userId }
    }, { $addToSet: { hiddenFor: userId } });

    res.json({ hidden: result.modifiedCount || 0 });
  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({ error: 'Error deleting messages' });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const { userId } = req.query;
    console.log('[GET /api/rooms] Fetching rooms for user:', userId);
    
    if (!userId) {
      return res.json([]);
    }
    
    // Return rooms where user is a member
    const rooms = await Room.find({ members: userId })
      .populate('admin', 'username avatar friendCode')
      .populate('members', 'username avatar friendCode')
      .select('name description admin members type joinCode createdAt');
    
    console.log('[GET /api/rooms] Rooms found:', rooms.length, 'rooms');
    res.json(rooms);
  } catch (error) {
    console.error('[GET /api/rooms] Error:', error);
    res.status(500).json({ error: 'Error fetching rooms' });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, description, adminId, type } = req.body;
    console.log('[POST /api/rooms] Creating room:', name);
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Room name required' });
    }
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID required' });
    }
    const existing = await Room.findOne({ name: name.trim() });
    if (existing) {
      console.log('[POST /api/rooms] Room already exists:', name);
      return res.status(409).json({ error: 'Room already exists' });
    }
    
    // Generate join code
    let joinCode;
    let codeExists = true;
    while (codeExists) {
      joinCode = generateFriendCode();
      codeExists = await Room.findOne({ joinCode });
    }
    
    const room = new Room({
      name: name.trim(),
      description,
      admin: adminId,
      members: [adminId],
      type: type || 'public',
      joinCode
    });
    await room.save();
    console.log('[POST /api/rooms] Room created:', room.name);
    
    const populated = await Room.findById(room._id).populate('admin', 'username avatar');
    res.status(201).json(populated);
  } catch (error) {
    console.error('[POST /api/rooms] Error:', error);
    res.status(500).json({ error: 'Error creating room' });
  }
});

app.delete('/api/rooms/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { userId } = req.query;
    
    const room = await Room.findOne({ name });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    // Only admin can delete
    if (room.admin.toString() !== userId) {
      return res.status(403).json({ error: 'Only admin can delete room' });
    }
    
    await Room.findOneAndDelete({ name });
    await Message.deleteMany({ room: name });
    res.json({ message: 'Room deleted', room });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting room' });
  }
});

app.put('/api/rooms/:name', async (req, res) => {
  try {
    const { name: oldName } = req.params;
    const { name: newName, userId } = req.body;
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New room name required' });
    }
    
    const room = await Room.findOne({ name: oldName });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    // Only admin can rename
    if (room.admin.toString() !== userId) {
      return res.status(403).json({ error: 'Only admin can rename room' });
    }
    
    room.name = newName.trim();
    await room.save();
    
    // Update all messages to new room name
    await Message.updateMany({ room: oldName }, { room: newName.trim() });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Error renaming room' });
  }
});

// Room search endpoint
app.get('/api/rooms/search', async (req, res) => {
  try {
    const { query, userId } = req.query;
    if (!query) {
      return res.json([]);
    }
    
    // Search by name or join code
    const rooms = await Room.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { joinCode: query.toUpperCase() }
      ]
    })
    .populate('admin', 'username avatar')
    .select('name description admin members type joinCode createdAt');
    
    // Filter out rooms user is already a member of
    const filtered = rooms.filter(r => !r.members.some(m => m.toString() === userId));
    
    res.json(filtered);
  } catch (error) {
    console.error('[SEARCH ROOMS] Error:', error);
    res.status(500).json({ error: 'Error searching rooms' });
  }
});

// Join room (public instant, private request)
app.post('/api/rooms/join', async (req, res) => {
  try {
    const { roomId, userId, joinCode } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    let room;
    if (roomId) {
      room = await Room.findById(roomId);
    } else if (joinCode) {
      room = await Room.findOne({ joinCode: joinCode.toUpperCase() });
    }
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if already a member
    if (room.members.some(m => m.toString() === userId)) {
      return res.status(409).json({ error: 'Already a member' });
    }
    
    // Check if already pending
    if (room.pendingMembers && room.pendingMembers.some(m => m.toString() === userId)) {
      return res.status(409).json({ error: 'Join request already pending' });
    }
    
    if (room.type === 'public') {
      // Auto-join public rooms
      room.members.push(userId);
      await room.save();
      const populated = await Room.findById(room._id).populate('admin', 'username avatar');
      return res.json({ joined: true, room: populated });
    } else {
      // Add to pending for private rooms
      room.pendingMembers.push(userId);
      await room.save();
      return res.json({ joined: false, pending: true, message: 'Join request sent to admin' });
    }
  } catch (error) {
    console.error('[JOIN ROOM] Error:', error);
    res.status(500).json({ error: 'Error joining room' });
  }
});

// Get pending join requests (admin only)
app.get('/api/rooms/:roomId/pending', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.query;
    
    const room = await Room.findById(roomId).populate('pendingMembers', 'username avatar friendCode');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Only admin can view pending
    if (room.admin.toString() !== userId) {
      return res.status(403).json({ error: 'Only admin can view pending requests' });
    }
    
    res.json(room.pendingMembers || []);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching pending members' });
  }
});

// Approve/reject join request (admin only)
app.post('/api/rooms/:roomId/approve', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, memberId, action } = req.body; // action: 'approve' or 'reject'
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Only admin can approve/reject
    if (room.admin.toString() !== userId) {
      return res.status(403).json({ error: 'Only admin can approve requests' });
    }
    
    // Remove from pending
    room.pendingMembers = room.pendingMembers.filter(m => m.toString() !== memberId);
    
    if (action === 'approve') {
      // Add to members
      if (!room.members.some(m => m.toString() === memberId)) {
        room.members.push(memberId);
      }
    }
    
    await room.save();
    res.json({ message: action === 'approve' ? 'Member approved' : 'Request rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});

// Leave room
app.post('/api/rooms/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Admin cannot leave their own room
    if (room.admin.toString() === userId) {
      return res.status(400).json({ error: 'Admin cannot leave room. Transfer admin or delete room.' });
    }
    
    room.members = room.members.filter(m => m.toString() !== userId);
    await room.save();
    
    res.json({ message: 'Left room' });
  } catch (error) {
    res.status(500).json({ error: 'Error leaving room' });
  }
});

app.get('/api/users/online', (req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
