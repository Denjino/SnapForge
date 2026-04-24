@echo off
cd /d "F:\And on the 5th Year\Projects\image-processor\server"
timeout /t 2 >nul
start http://localhost:3001
npm start