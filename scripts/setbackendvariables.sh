# echo pass in username password hostname of big data cluster
export BDC_BACKEND_USERNAME=$1
export BDC_BACKEND_PWD=$2
export BDC_BACKEND_HOSTNAME=$3
export PYTHON_TEST_PATH=$4
export STANDALONE_SQL_USERNAME=%~5
export STANDALONE_SQL_PWD=%~6
echo No problem reading $BDC_BACKEND_USERNAME, password, $BDC_BACKEND_HOSTNAME, $PYTHON_TEST_PATH, $STANDALONE_SQL_USERNAME and $STANDALONE_SQL_PWD
set