setlocal

set ADS_TEST_GREP=Schema compare integration test suite
set ADS_TEST_INVERT_GREP=

echo Running UNSTABLE ADS Extension Integration tests

call %~dp0\sql-test-integration.bat

endlocal
