@echo off
setlocal

set "ADS_TEST_GREP=(@UNSTABLE@|Unexpected Errors & Loader Errors)"
set ADS_TEST_INVERT_GREP=

echo Running UNSTABLE ADS Core Tests

call %~dp0\test.bat %*

endlocal
