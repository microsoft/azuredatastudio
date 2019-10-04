setlocal

set ADS_TEST_GREP=@UNSTABLE@

echo Running unstable tests

call %~dp0\sql-test-integration.bat

endlocal
