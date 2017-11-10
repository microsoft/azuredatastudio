@echo off

CALL gulp --max_old_space_size=2000 electron-ia32
CALL "%~dp0\test.bat"
CALL gulp --max_old_space_size=2000 optimize-vscode

:error
echo Exit code %errorlevel%
exit /b %errorlevel%