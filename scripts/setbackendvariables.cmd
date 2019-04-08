@echo off pass in username password hostname of big data cluster, please use "" for BDC_BACKEND_HOSTNAME to include port.
@echo For example: setbackendvariables.cmd sa pwd "23.101.143.196,31433" pythonPath standaloneSql standaloneSqlUser standaloneSqlPwd azureSql azureSqlUser azureSqlPwd 1 1
set BDC_BACKEND_USERNAME=%~1
set BDC_BACKEND_PWD=%~2
set BDC_BACKEND_HOSTNAME=%~3
set PYTHON_TEST_PATH=%~4

set STANDALONE_SQL=%~5
set STANDALONE_SQL_USERNAME=%~6
set STANDALONE_SQL_PWD=%~7

set AZURE_SQL=%~8
set AZURE_SQL_USERNAME=%~9
shift
set AZURE_SQL_PWD=%~9
shift
set RUN_PYTHON3_TEST=%~9
shift
set RUN_PYSPARK_TEST=%~9

@echo No problem reading BDC cluster: %BDC_BACKEND_USERNAME%, bdc_password, %BDC_BACKEND_HOSTNAME% and %PYTHON_TEST_PATH%
@echo No problem reading Standalone SQL instance: %STANDALONE_SQL%, %STANDALONE_SQL_USERNAME% and standalone_sql_password
@echo No problem reading AZURE SQL instance: %AZURE_SQL%, %AZURE_SQL_USERNAME% and %AZURE_SQL_PWD%
@echo No problem reading run python test: %RUN_PYTHON3_TEST% and %RUN_PYSPARK_TEST%