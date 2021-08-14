:: Runs Extension tests

@echo off
setlocal

pushd %~dp0\..

set VSCODEUSERDATADIR=%TMP%\adsuser_%RANDOM%-%TIME:~6,5%
set VSCODEEXTENSIONSDIR=%TMP%\adsext_%RANDOM%-%TIME:~6,5%
echo VSCODEUSERDATADIR : '%VSCODEUSERDATADIR%'
echo VSCODEEXTENSIONSDIR : '%VSCODEEXTENSIONSDIR%'
set VSCODECRASHDIR=%~dp0\..\.build\crashes

:: Figure out which Electron to use for running tests
if "%INTEGRATION_TEST_ELECTRON_PATH%"=="" (
	:: Run out of sources: no need to compile as code.bat takes care of it
	chcp 65001
	set INTEGRATION_TEST_ELECTRON_PATH=.\scripts\code.bat
	set VSCODE_BUILD_BUILTIN_EXTENSIONS_SILENCE_PLEASE=1

	echo Storing crash reports into '%VSCODECRASHDIR%'.
	echo Running unit tests out of sources.
) else (
	:: Run from a built: need to compile all test extensions
	:: because we run extension tests from their source folders
	:: and the build bundles extensions into .build webpacked
	:: {{SQL CARBON EDIT}} Don't compile unused extensions
	call yarn gulp 	compile-extension:admin-tool-ext-win^
					compile-extension:agent^
					compile-extension:arc^
					compile-extension:azurecore^
					compile-extension:cms^
					compile-extension:dacpac^
					compile-extension:import^
					compile-extension:schema-compare^
					compile-extension:machine-learning^
					compile-extension:mssql^
					compile-extension:notebook^
					compile-extension:resource-deployment^
					compile-extension:sql-database-projects

	:: Configuration for more verbose output
	set VSCODE_CLI=1
	set ELECTRON_ENABLE_LOGGING=1

	echo Storing crash reports into '%VSCODECRASHDIR%'.
	echo Running unit tests with '%INTEGRATION_TEST_ELECTRON_PATH%' as build.
)

:: Default to only running stable tests if test grep isn't set
if "%ADS_TEST_GREP%" == "" (
	echo "Running stable tests only"
	set ADS_TEST_GREP=@UNSTABLE@
	SET ADS_TEST_INVERT_GREP=1
)

set ALL_PLATFORMS_API_TESTS_EXTRA_ARGS=--disable-telemetry --crash-reporter-directory=%VSCODECRASHDIR% --no-cached-data --disable-updates --disable-keytar --user-data-dir=%VSCODEUSERDATADIR% --remote-debugging-port=9222 --extensions-dir=%VSCODEEXTENSIONSDIR%

echo ***************************************************
echo *** starting admin tool extension windows tests ***
echo ***************************************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\admin-tool-ext-win --extensionTestsPath=%~dp0\..\extensions\admin-tool-ext-win\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo ****************************
echo *** starting agent tests ***
echo ****************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\agent --extensionTestsPath=%~dp0\..\extensions\agent\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo **************************
echo *** starting arc tests ***
echo **************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\arc --extensionTestsPath=%~dp0\..\extensions\arc\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo *****************************
echo *** starting azcli tests ***
echo *****************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\azcli --extensionTestsPath=%~dp0\..\extensions\azcli\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo ********************************
echo *** starting azurecore tests ***
echo ********************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\azurecore --extensionTestsPath=%~dp0\..\extensions\azurecore\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo **************************
echo *** starting cms tests ***
echo **************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\cms --extensionTestsPath=%~dp0\..\extensions\cms\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo *****************************
echo *** starting dacpac tests ***
echo *****************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\dacpac --extensionTestsPath=%~dp0\..\extensions\dacpac\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo *****************************
echo *** starting import tests ***
echo *****************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\import --extensionTestsPath=%~dp0\..\extensions\import\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo *************************************
echo *** starting schema compare tests ***
echo *************************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\schema-compare --extensionTestsPath=%~dp0\..\extensions\schema-compare\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo *******************************
echo *** starting notebook tests ***
echo *******************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\notebook --extensionTestsPath=%~dp0\..\extensions\notebook\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo ******************************************
echo *** starting resource deployment tests ***
echo ******************************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\resource-deployment --extensionTestsPath=%~dp0\..\extensions\resource-deployment\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo *******************************
echo *** starting machine-learning tests ***
echo *******************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\machine-learning --extensionTestsPath=%~dp0\..\extensions\machine-learning\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

REM echo ******************************************
REM echo *** starting mssql tests ***
REM echo ******************************************
REM call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\mssql --extensionTestsPath=%~dp0\..\extensions\mssql\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo ********************************************
echo *** starting sql-database-projects tests ***
echo ********************************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\sql-database-projects --extensionTestsPath=%~dp0\..\extensions\sql-database-projects\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

echo ********************************************
echo *** starting data-workspace tests ***
echo ********************************************
call "%INTEGRATION_TEST_ELECTRON_PATH%" --extensionDevelopmentPath=%~dp0\..\extensions\data-workspace --extensionTestsPath=%~dp0\..\extensions\data-workspace\out\test %ALL_PLATFORMS_API_TESTS_EXTRA_ARGS%

if %errorlevel% neq 0 exit /b %errorlevel%

if "%NO_CLEANUP%"=="" (
	rmdir /s /q %VSCODEUSERDATADIR%
	rmdir /s /q %VSCODEEXTENSIONSDIR%
)

popd

endlocal
