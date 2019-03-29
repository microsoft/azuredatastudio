@echo off pass in username password hostname of big data cluster, please use "" for BDC_BACKEND_HOSTNAME to include port.
@echo For example: setbackendvariables.cmd sa pwd "23.101.143.196,31433" pythonPath adstest standaloneSqlPwd
set BDC_BACKEND_USERNAME=%~1
set BDC_BACKEND_PWD=%~2
set BDC_BACKEND_HOSTNAME=%~3
set PYTHON_TEST_PATH=%~4
set STANDALONE_SQL_USERNAME=%~5
set STANDALONE_SQL_PWD=%~6
@echo No problem reading %BDC_BACKEND_USERNAME%, password, %BDC_BACKEND_HOSTNAME%, %PYTHON_TEST_PATH%, %STANDALONE_SQL_USERNAME% and %STANDALONE_SQL_PWD%