:: Runs unit tests for Extensions

setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser-%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext-%RANDOM%-%TIME:~6,5%
echo %VSCODEUSERDATADIR%
echo %VSCODEEXTENSIONSDIR%
@echo OFF

call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\notebook --extensionTestsPath=%~dp0\..\extensions\notebook\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
call .\scripts\code.bat --extensionDevelopmentPath=%~dp0\..\extensions\admin-tool-ext-win --extensionTestsPath=%~dp0\..\extensions\admin-tool-ext-win\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --disableExtensions --remote-debugging-port=9222

if %errorlevel% neq 0 exit /b %errorlevel%

rmdir /s /q %VSCODEUSERDATADIR%
rmdir /s /q %VSCODEEXTENSIONSDIR%

popd

endlocal
