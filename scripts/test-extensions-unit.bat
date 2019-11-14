:: Runs Extension tests

setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser-%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext-%RANDOM%-%TIME:~6,5%
echo %VSCODEUSERDATADIR%
echo %VSCODEEXTENSIONSDIR%

:: Default to only running stable tests if test grep isn't set
if "%ADS_TEST_GREP%" == "" (
	echo Running stable tests only
	set ADS_TEST_GREP=@UNSTABLE@
	SET ADS_TEST_INVERT_GREP=1
)

@echo OFF

echo ***************************************************
echo *** starting admin tool extension windows tests ***
echo ***************************************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\admin-tool-ext-win --extensionTestsPath=%~dp0\..\extensions\admin-tool-ext-win\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --disableExtensions --remote-debugging-port=9222

echo ****************************
echo *** starting agent tests ***
echo ****************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\agent --extensionTestsPath=%~dp0\..\extensions\agent\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

echo ********************************
echo *** starting azurecore tests ***
echo ********************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\azurecore --extensionTestsPath=%~dp0\..\extensions\azurecore\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

echo **************************
echo *** starting cms tests ***
echo **************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\cms --extensionTestsPath=%~dp0\..\extensions\cms\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

echo *****************************
echo *** starting dacpac tests ***
echo *****************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\dacpac --extensionTestsPath=%~dp0\..\extensions\dacpac\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

echo *************************************
echo *** starting schema compare tests ***
echo *************************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\schema-compare --extensionTestsPath=%~dp0\..\extensions\schema-compare\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

echo *******************************
echo *** starting notebook tests ***
echo *******************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\notebook --extensionTestsPath=%~dp0\..\extensions\notebook\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

echo ******************************************
echo *** starting resource deployment tests ***
echo ******************************************
call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\resource-deployment --extensionTestsPath=%~dp0\..\extensions\resource-deployment\out\test --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

if %errorlevel% neq 0 exit /b %errorlevel%

rmdir /s /q %VSCODEUSERDATADIR%
rmdir /s /q %VSCODEEXTENSIONSDIR%

popd

endlocal
