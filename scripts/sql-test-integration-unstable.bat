setlocal

set ADS_TEST_GREP=@UNSTABLE@

echo Running UNSTABLE ADS Extension Integration tests

call %~dp0\sql-test-integration.bat

endlocal
