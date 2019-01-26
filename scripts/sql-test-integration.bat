setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser-%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext-%RANDOM%-%TIME:~6,5%
echo %VSCODEUSERDATADIR%
echo %VSCODEEXTENSIONSDIR%
@echo OFF

call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\integration-tests --extensionTestsPath=%~dp0\..\extensions\integration-tests\out --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR%

if %errorlevel% neq 0 exit /b %errorlevel%

rmdir /s /q %VSCODEUSERDATADIR%
rmdir /s /q %VSCODEEXTENSIONSDIR%

popd

endlocal
