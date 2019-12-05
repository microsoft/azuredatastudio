@echo OFF
setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser-%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext-%RANDOM%-%TIME:~6,5%
echo VSCODEUSERDATADIR=%VSCODEUSERDATADIR%
echo VSCODEEXTENSIONSDIR=%VSCODEEXTENSIONSDIR%

:: Figure out which Electron to use for running tests
if "%INTEGRATION_TEST_ELECTRON_PATH%"=="" (
	:: Run out of sources: no need to compile as code.sh takes care of it
	set INTEGRATION_TEST_ELECTRON_PATH=.\scripts\code.bat

	echo "Running integration tests out of sources."
) else (
	:: Run from a built: need to compile all test extensions
	call yarn gulp compile-extension:integration-tests
	call yarn gulp compile-extension:admin-tool-ext-win
	call yarn gulp compile-extension:agent
	call yarn gulp compile-extension:cms
	call yarn gulp compile-extension:dacpac
	call yarn gulp compile-extension:import
	call yarn gulp compile-extension:profiler
	call yarn gulp compile-extension:schema-compare

	echo "Running integration tests with '%INTEGRATION_TEST_ELECTRON_PATH%' as build."
)

:: Default to only running stable tests if test grep isn't set
if "%ADS_TEST_GREP%" == "" (
	echo Running stable tests only
	set ADS_TEST_GREP=@UNSTABLE@
	SET ADS_TEST_INVERT_GREP=1
)

if "%SKIP_PYTHON_INSTALL_TEST%" == "1" (
	echo Skipping Python installation tests.
) else (
	set PYTHON_TEST_PATH=%VSCODEUSERDATADIR%\TestPythonInstallation
	echo %PYTHON_TEST_PATH%
	call %INTEGRATION_TEST_ELECTRON_PATH% --nogpu --extensionDevelopmentPath=%~dp0\..\extensions\notebook --extensionTestsPath=%~dp0\..\extensions\notebook\out\integrationTest --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222
)

:: only external extensions are included as additional development here and must be compiled in a previous step if running on pipelines
call %INTEGRATION_TEST_ELECTRON_PATH% -nogpu --user-data-dir=%VSCODEUSERDATADIR% --extensions-dir=%VSCODEEXTENSIONSDIR% --remote-debugging-port=9222 ^
--extensionDevelopmentPath=%~dp0\..\extensions\integration-tests --extensionTestsPath=%~dp0\..\extensions\integration-tests\out ^
--extensionDevelopmentPath=%~dp0\..\extensions\admin-tool-ext-win ^
--extensionDevelopmentPath=%~dp0\..\extensions\agent ^
--extensionDevelopmentPath=%~dp0\..\extensions\cms ^
--extensionDevelopmentPath=%~dp0\..\extensions\dacpac ^
--extensionDevelopmentPath=%~dp0\..\extensions\import ^
--extensionDevelopmentPath=%~dp0\..\extensions\profiler ^
--extensionDevelopmentPath=%~dp0\..\extensions\schema-compare ^

rmdir /s /q %VSCODEUSERDATADIR%
rmdir /s /q %VSCODEEXTENSIONSDIR%

if %errorlevel% neq 0 exit /b %errorlevel%

popd

endlocal
