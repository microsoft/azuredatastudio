#!/usr/bin/env bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
	# Electron 6 introduces a chrome-sandbox that requires root to run. This can fail. Disable sandbox via --no-sandbox.
	LINUX_EXTRA_ARGS="--no-sandbox"
fi

VSCODEUSERDATADIR=`mktemp -d -t adsuser_XXXXXXXXXX 2>/dev/null`
VSCODEEXTDIR=`mktemp -d -t adsext_XXXXXXXXXX 2>/dev/null`
VSCODECRASHDIR=$ROOT/.build/crashes
cd $ROOT

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

# Figure out which Electron to use for running tests
if [ -z "$INTEGRATION_TEST_ELECTRON_PATH" ]
then
	# Run out of sources: no need to compile as code.sh takes care of it
	INTEGRATION_TEST_ELECTRON_PATH="./scripts/code.sh"

	echo "Storing crash reports into '$VSCODECRASHDIR'."
	echo "Running integration tests out of sources."
else
	# Run from a built: need to compile all test extensions
	# because we run extension tests from their source folders
	# and the build bundles extensions into .build webpacked
	yarn gulp 	compile-extension:admin-tool-ext-win \
				compile-extension:agent \
				compile-extension:arc \
				compile-extension:azurecore \
				compile-extension:cms \
				compile-extension:dacpac \
				compile-extension:datavirtualization \
				compile-extension:import \
				compile-extension:machine-learning \
				compile-extension:mssql \
				compile-extension:notebook \
				compile-extension:query-history \
				compile-extension:query-store \
				compile-extension:resource-deployment \
				compile-extension:schema-compare \
				compile-extension:sql-bindings \
				compile-extension:sql-database-projects

	# Configuration for more verbose output
	export VSCODE_CLI=1
	export ELECTRON_ENABLE_STACK_DUMPING=1
	export ELECTRON_ENABLE_LOGGING=1

	# Production builds are run on docker containers where size of /dev/shm partition < 64MB which causes OOM failure
	# for chromium compositor that uses the partition for shared memory
	if [ "$LINUX_EXTRA_ARGS" ]
	then
		LINUX_EXTRA_ARGS="$LINUX_EXTRA_ARGS  --disable-dev-shm-usage --use-gl=swiftshader"
	fi

	echo "Storing crash reports into '$VSCODECRASHDIR'."
	echo "Running integration tests with '$INTEGRATION_TEST_ELECTRON_PATH' as build."
fi

if [ -z "$INTEGRATION_TEST_APP_NAME" ]; then
	after_suite() { true; }
else
	after_suite() { killall $INTEGRATION_TEST_APP_NAME || true; }
fi

cd $ROOT
echo "VSCODEUSERDATADIR : '$VSCODEUSERDATADIR'"
echo "VSCODEEXTDIR : '$VSCODEEXTDIR'"

ALL_PLATFORMS_API_TESTS_EXTRA_ARGS="--disable-telemetry --crash-reporter-directory=$VSCODECRASHDIR --no-cached-data --disable-updates --disable-extensions --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR"

echo ***************************************************
echo *** starting admin tool extension windows tests ***
echo ***************************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/admin-tool-ext-win --extensionTestsPath=$ROOT/extensions/admin-tool-ext-win/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ****************************
echo *** starting agent tests ***
echo ****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/agent --extensionTestsPath=$ROOT/extensions/agent/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo **************************
echo *** starting arc tests ***
echo **************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/arc --extensionTestsPath=$ROOT/extensions/arc/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo *****************************
echo *** starting azcli tests ***
echo *****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/azcli --extensionTestsPath=$ROOT/extensions/azcli/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ********************************
echo *** starting azurecore tests ***
echo ********************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/azurecore --extensionTestsPath=$ROOT/extensions/azurecore/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo **************************
echo *** starting cms tests ***
echo **************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/cms --extensionTestsPath=$ROOT/extensions/cms/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo *****************************
echo *** starting dacpac tests ***
echo *****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/dacpac --extensionTestsPath=$ROOT/extensions/dacpac/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo *****************************************
echo *** starting datavirtualization tests ***
echo *****************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/datavirtualization --extensionTestsPath=$ROOT/extensions/datavirtualization/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

# {{SQL CARBON TODO}} - disable tests for this extension
# echo ********************************************
# echo *** starting data-workspace tests ***
# echo ********************************************
# "$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/data-workspace --extensionTestsPath=$ROOT/extensions/data-workspace/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo *****************************
echo *** starting import tests ***
echo *****************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/import --extensionTestsPath=$ROOT/extensions/import/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ************************************************
echo *** starting machine-learning tests ***
echo ************************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/machine-learning --extensionTestsPath=$ROOT/extensions/machine-learning/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

# echo ******************************************
# echo *** starting mssql tests ***
# echo ******************************************
# "$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/mssql --extensionTestsPath=$ROOT/extensions/mssql/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo *******************************
echo *** starting notebook tests ***
echo *******************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/notebook --extensionTestsPath=$ROOT/extensions/notebook/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ******************************************
echo *** starting query-history tests ***
echo ******************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/query-history --extensionTestsPath=$ROOT/extensions/query-history/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ********************************************
echo *** starting query-store tests ***
echo ********************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/query-store --extensionTestsPath=$ROOT/extensions/query-store/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ******************************************
echo *** starting resource deployment tests ***
echo ******************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/resource-deployment --extensionTestsPath=$ROOT/extensions/resource-deployment/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo *************************************
echo *** starting schema compare tests ***
echo *************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/schema-compare --extensionTestsPath=$ROOT/extensions/schema-compare/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ********************************************
echo *** starting sql-bindings tests ***
echo ********************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/sql-bindings --extensionTestsPath=$ROOT/extensions/sql-bindings/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

echo ********************************************
echo *** starting sql-database-projects tests ***
echo ********************************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_EXTRA_ARGS --extensionDevelopmentPath=$ROOT/extensions/sql-database-projects --extensionTestsPath=$ROOT/extensions/sql-database-projects/out/test $ALL_PLATFORMS_API_TESTS_EXTRA_ARGS

if [[ "$NO_CLEANUP" == "" ]]; then
	rm -r $VSCODEUSERDATADIR
	rm -r $VSCODEEXTDIR
fi
