@echo off
title Anum Vista - Auto-Start Setup
color 0B

echo.
echo  ============================================
echo   Setting up Auto-Start on Windows Login
echo  ============================================
echo.

REM Create a shortcut in Windows Startup folder
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SCRIPT_PATH=%~dp0START_ANUM_VISTA.bat

REM Use PowerShell to create a proper shortcut
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%STARTUP_FOLDER%\AnumVista.lnk'); $sc.TargetPath = '%SCRIPT_PATH%'; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'Anum Vista Property Management'; $sc.Save()"

echo  Auto-start shortcut created!
echo.
echo  Anum Vista will now start automatically
echo  whenever this computer is turned on.
echo.
echo  To remove auto-start, delete this file:
echo  %STARTUP_FOLDER%\AnumVista.lnk
echo.
pause
