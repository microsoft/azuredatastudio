@echo off
setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\ads-userfolder-%RANDOM%-%TIME:~6,5%

:: Tests in the extension host
call .\scripts\code.bat %~dp0\..\extensions\integration-tests\test --extensionDevelopmentPath=%~dp0\..\extensions\integration-tests --extensionTestsPath=%~dp0\..\extensions\integration-tests\out --user-data-dir=%VSCODEUSERDATADIR%
if %errorlevel% neq 0 exit /b %errorlevel%

rmdir /s /q %VSCODEUSERDATADIR%

popd

endlocal
