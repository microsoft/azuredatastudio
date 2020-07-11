#!/bin/bash
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
echo VSCODEUSERDATADIR=$VSCODEUSERDATADIR
echo VSCODEEXTDIR=$VSCODEEXTDIR

if [[ "$SKIP_PYTHON_INSTALL_TEST" == "1" ]]; then
	echo Skipping Python installation tests.
else
	export PYTHON_TEST_PATH=$VSCODEUSERDATADIR/TestPythonInstallation
	echo $PYTHON_TEST_PATH

	"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --nogpu --extensionDevelopmentPath=$ROOT/extensions/notebook --extensionTestsPath=$ROOT/extensions/notebook/out/integrationTest --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --remote-debugging-port=9222 --disable-telemetry --disable-crash-reporter --disable-updates --skip-getting-started --disable-inspect
fi

"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --nogpu --extensionDevelopmentPath=$ROOT/extensions/admin-pack \
--extensionDevelopmentPath=$ROOT/extensions/admin-tool-ext-win \
--extensionDevelopmentPath=$ROOT/extensions/agent \
--extensionDevelopmentPath=$ROOT/extensions/azurecore \
--extensionDevelopmentPath=$ROOT/extensions/big-data-cluster \
--extensionDevelopmentPath=$ROOT/extensions/cms \
--extensionDevelopmentPath=$ROOT/extensions/dacpac \
--extensionDevelopmentPath=$ROOT/extensions/import \
--extensionDevelopmentPath=$ROOT/extensions/integration-tests \
--extensionDevelopmentPath=$ROOT/extensions/mssql \
--extensionDevelopmentPath=$ROOT/extensions/notebook \
--extensionDevelopmentPath=$ROOT/extensions/profiler \
--extensionDevelopmentPath=$ROOT/extensions/resource-deployment \
--extensionDevelopmentPath=$ROOT/extensions/schema-compare \
--extensionTestsPath=$ROOT/extensions/integration-tests/out/tests \
--user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR \
--disable-telemetry --disable-crash-reporter --disable-updates --skip-getting-started --disable-inspect


rm -r -f $VSCODEUSERDATADIR
rm -r $VSCODEEXTDIR
