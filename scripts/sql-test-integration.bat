setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser-%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext-%RANDOM%-%TIME:~6,5%
echo VSCODEUSERDATADIR=%VSCODEUSERDATADIR%
echo VSCODEEXTENSIONSDIR=%VSCODEEXTENSIONSDIR%

:: Default to only running stable tests if test grep isn't set
if "%ADS_TEST_GREP%" == "" (
	echo Running stable tests only
	set ADS_TEST_GREP=@UNSTABLE@
	SET ADS_TEST_INVERT_GREP=1
)

@echo OFF

if "%SKIP_PYTHON_INSTALL_TEST%" == "1" (
	echo Skipping Python installation tests.
) else (
	set PYTHON_TEST_PATH=%VSCODEUSERDATADIR%\TestPythonInstallation
	echo %PYTHON_TEST_PATH%
	call .\scripts\code.bat --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\notebook --extensionTestsPath=%~dp0\..\extensions\notebook\out\integrationTest --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
)

call .\scripts\code.bat -nogpu --extensionDevelopmentPath=%~dp0\..\extensions\integration-tests --extensionTestsPath=%~dp0\..\extensions\integration-tests\out --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222

rmdir /s /q %VSCODEUSERDATADIR%
rmdir /s /q %VSCODEEXTENSIONSDIR%

if %errorlevel% neq 0 exit /b %errorlevel%

popd

endlocal
