@echo off pass in username password hostname of big data cluster, please use "" for BDC_BACKEND_HOSTNAME to include port.
@echo For example: setbackendvariables.cmd sa pwd "23.101.143.196,31433" C:\Users\yuronhe\azuredatastudio-python
set BDC_BACKEND_USERNAME=%~1
set BDC_BACKEND_PWD=%~2
set BDC_BACKEND_HOSTNAME=%~3
set PYTHON_TEST_PATH=%~4
@echo No problem reading %BDC_BACKEND_USERNAME%, password, %BDC_BACKEND_HOSTNAME% and %PYTHON_TEST_PATH%