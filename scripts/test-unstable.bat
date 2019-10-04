setlocal

set ADS_TEST_GREP=@UNSTABLE@

echo Running UNSTABLE ADS Core Tests

call %~dp0\test.bat

endlocal
