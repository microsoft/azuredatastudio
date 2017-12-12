@echo off
SET SUPPORTEDNPMVERSION=4.2.0

for /F "tokens=* USEBACKQ" %%V IN (`npm --version`) do (
	set CURRENTNPMVERSION=%%V
)

if %CURRENTNPMVERSION%==%SUPPORTEDNPMVERSION% (
	setlocal
	set npm_config_disturl="https://atom.io/download/electron"
	for /f "tokens=2 delims=:, " %%a in ('findstr /R /C:"\"electronVersion\":.*" "%~dp0..\package.json"') do set npm_config_target=%%~a
	set npm_config_runtime="electron"
	set npm_config_cache=~\.npm-electron
	npm %*
	endlocal
) else (
	echo NPM version %CURRENTNPMVERSION% is not compatible with this project. Please, install version %SUPPORTEDNPMVERSION%
)
