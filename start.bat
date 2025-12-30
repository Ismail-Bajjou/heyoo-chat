@echo off
echo Heyoo - Start Script
echo =======================
echo.
echo Starting services...
echo.

REM Check if MongoDB is running
echo Checking MongoDB...
mongosh --eval "db.version()" >nul 2>&1
if errorlevel 1 (
    echo WARNING: MongoDB is not running!
    echo Please start MongoDB in a separate terminal with: mongod
    echo.
)

REM Start the backend
echo Starting backend server (port 5000)...
start "Chat Server" cmd /k cd server ^& npm run dev

REM Wait a moment for backend to start
timeout /t 3 /nobreak

REM Start the frontend
echo Starting frontend client (port 3000)...
start "Chat Client" cmd /k cd client ^& npm start

echo.
echo All services started!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Close these windows to stop the services.
