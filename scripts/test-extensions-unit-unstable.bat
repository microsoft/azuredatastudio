:: Runs UNSTABLE Extension Tests

setlocal

set ADS_TEST_GREP=@UNSTABLE@
set ADS_TEST_INVERT_GREP=

echo Running UNSTABLE Extension Tests

call %~dp0\test-extensions-unit.bat

endlocal
