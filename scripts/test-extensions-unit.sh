#!/bin/bash

# Runs Extension Tests
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
	VSCODEUSERDATADIR=`mktemp -d -t 'myuserdatadir'`
	VSCODEEXTDIR=`mktemp -d -t 'myextdir'`
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
	VSCODEUSERDATADIR=`mktemp -d 2>/dev/null`
	VSCODEEXTDIR=`mktemp -d 2>/dev/null`
	LINUX_NO_SANDBOX="--no-sandbox" # Electron 6 introduces a chrome-sandbox that requires root to run. This can fail. Disable sandbox via --no-sandbox.
fi

# Default to only running stable tests if test grep isn't set
if [[ "$ADS_TEST_GREP" == "" ]]; then
	echo Running stable tests only
	export ADS_TEST_GREP=@UNSTABLE@
	export ADS_TEST_INVERT_GREP=1
fi

# Figure out which Electron to use for running tests
if [ -z "$INTEGRATION_TEST_ELECTRON_PATH" ]
then
	# Run out of sources: no need to compile as code.sh takes care of it
	INTEGRATION_TEST_ELECTRON_PATH="./scripts/code.sh"

	echo "Running integration tests out of sources."
else
	# Run from a built: need to compile all test extensions

	echo "Running integration tests with '$INTEGRATION_TEST_ELECTRON_PATH' as build."
fi

cd $ROOT
echo $VSCODEUSERDATADIR
echo $VSCODEEXTDIR

echo ***************************************************
echo *** starting admin tool extension windows tests ***
echo ***************************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/admin-tool-ext-win --extensionTestsPath=$ROOT/extensions/admin-tool-ext-win/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo ****************************
echo *** starting agent tests ***
echo ****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/agent --extensionTestsPath=$ROOT/extensions/agent/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo **************************
echo *** starting arc tests ***
echo **************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/arc --extensionTestsPath=$ROOT/extensions/arc/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo *****************************
echo *** starting azdata tests ***
echo *****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/azdata --extensionTestsPath=$ROOT/extensions/azdata/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo ********************************
echo *** starting azurecore tests ***
echo ********************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/azurecore --extensionTestsPath=$ROOT/extensions/azurecore/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo **************************
echo *** starting cms tests ***
echo **************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/cms --extensionTestsPath=$ROOT/extensions/cms/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo *****************************
echo *** starting dacpac tests ***
echo *****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/dacpac --extensionTestsPath=$ROOT/extensions/dacpac/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo *****************************
echo *** starting import tests ***
echo *****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/import --extensionTestsPath=$ROOT/extensions/import/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo *************************************
echo *** starting schema compare tests ***
echo *************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/schema-compare --extensionTestsPath=$ROOT/extensions/schema-compare/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo *******************************
echo *** starting notebook tests ***
echo *******************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/notebook --extensionTestsPath=$ROOT/extensions/notebook/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo ******************************************
echo *** starting resource deployment tests ***
echo ******************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/resource-deployment --extensionTestsPath=$ROOT/extensions/resource-deployment/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

echo ************************************************
echo *** starting machine-learning tests ***
echo ************************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/machine-learning --extensionTestsPath=$ROOT/extensions/machine-learning/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

# echo ******************************************
# echo *** starting mssql tests ***
# echo ******************************************
# "$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/mssql --extensionTestsPath=$ROOT/extensions/mssql/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

if [[ "$RUN_DBPROJECT_TESTS" == "true" ]]; then
	echo ********************************************
	echo *** starting sql-database-projects tests ***
	echo ********************************************
	"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/sql-database-projects --extensionTestsPath=$ROOT/extensions/sql-database-projects/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu
fi

rm -r $VSCODEUSERDATADIR
rm -r $VSCODEEXTDIR
