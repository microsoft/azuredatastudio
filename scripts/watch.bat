CALL gulp --max_old_space_size=2000 watch || goto :error
:error
echo Failed with error #%errorlevel%
exit /b %errorlevel%
