@echo off
setlocal

pushd "%~dp0\..\test\smoke"

node test\index.js %*

popd

endlocal
