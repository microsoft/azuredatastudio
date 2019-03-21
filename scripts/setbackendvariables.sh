# echo pass in username password hostname of big data cluster
export BDC_BACKEND_USERNAME=$1
export BDC_BACKEND_PWD=$2
export BDC_BACKEND_HOSTNAME=$3
export PYTHON_TEST_PATH=$4
echo No problem reading $BDC_BACKEND_USERNAME, password, $BDC_BACKEND_HOSTNAME and $PYTHON_TEST_PATH
set