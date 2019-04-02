# echo pass in username password hostname of big data cluster
export BDC_BACKEND_USERNAME=$1
export BDC_BACKEND_PWD=$2
export BDC_BACKEND_HOSTNAME=$3
export PYTHON_TEST_PATH=$4

export STANDALONE_SQL=%~5
export STANDALONE_SQL_USERNAME=%~6
export STANDALONE_SQL_PWD=%~7

export AZURE_SQL=%~8
export AZURE_SQL_USERNAME=%~9
export AZURE_SQL_PWD=%~10

echo No problem reading BDC cluster$BDC_BACKEND_USERNAME, password, $BDC_BACKEND_HOSTNAME and $PYTHON_TEST_PATH,
echo No problem reading Standalone SQL instance: $STANDALONE_SQL, $STANDALONE_SQL_USERNAME and $STANDALONE_SQL_PWD
echo No problem reading AZURE SQL instance: $AZURE_SQL, $AZURE_SQL_USERNAME and $AZURE_SQL_PWD

set