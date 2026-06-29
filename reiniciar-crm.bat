@echo off
REM Reinicia o dev server do CRM Callface (porta 3010).
REM Uso: duplo clique quando o localhost ficar "só carregando" (Turbopack degrada após horas).
echo Matando processo da porta 3010...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3010 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul
echo Subindo dev server...
cd /d "%~dp0app"
start "CRM Callface" /min cmd /c "npm run dev -- -p 3010"
echo CRM reiniciando em http://localhost:3010 (aguarde ~10s)
timeout /t 5 >nul
