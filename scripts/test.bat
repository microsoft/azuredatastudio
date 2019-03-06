@echo off
setlocal

set ELECTRON_RUN_AS_NODE=

pushd %~dp0\..

for /f "tokens=2 delims=:," %%a in ('findstr /R /C:"\"nameShort\":.*" product.json') do set NAMESHORT=%%~a
set NAMESHORT=%NAMESHORT: "=%
set NAMESHORT=%NAMESHORT:"=%.exe
set CODE=".build\electron\%NAMESHORT%"

:: Download Electron if needed
node build\lib\electron.js
if %errorlevel% neq 0 node .\node_modules\gulp\bin\gulp.js electron

:: Run tests
rem TFS Builds
if not "%BUILD_BUILDID%" == "" (
	if not "%ADD_REPORTER%" == "" (
		%CODE% .\test\electron\index.js --reporter mocha-junit-reporter %*
	)

	if "%ADD_REPORTER%" == "" (
		:: Run tests
		%CODE% .\test\electron\index.js %*
	)
)

rem Otherwise
if "%BUILD_BUILDID%" == "" (
	%CODE% .\test\electron\index.js %*
)
popd

endlocal
exit /b %errorlevel%
