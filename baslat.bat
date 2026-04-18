@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo === Gym-Quest: API + Expo (temiz cache) ===
echo.

if not exist "artifacts\api-server\package.json" (
  echo HATA: artifacts\api-server bulunamadi. baslat.bat dosyasi proje kok dizininde olmali.
  pause
  exit /b 1
)
if not exist "artifacts\gymquest\package.json" (
  echo HATA: artifacts\gymquest bulunamadi.
  pause
  exit /b 1
)

rem Iki ayri pencere: API (build+start), Expo (Metro --clear)
start "Gym-Quest API" cmd /k pushd "%~dp0artifacts\api-server" ^&^& echo [API] npm run dev... ^&^& npm run dev
timeout /t 2 /nobreak >nul
start "Gym-Quest Expo" cmd /k pushd "%~dp0artifacts\gymquest" ^&^& echo [Expo] npx expo start --clear... ^&^& npx expo start --clear

echo.
echo Iki pencere acildi: "Gym-Quest API" ve "Gym-Quest Expo". Bu pencereyi kapatabilirsiniz.
echo.
pause
