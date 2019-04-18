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
fi

export PYTHON_TEST_PATH=$VSCODEUSERDATADIR/TestPythonInstallation

cd $ROOT
echo $VSCODEUSERDATADIR
echo $VSCODEEXTDIR
echo $PYTHON_TEST_PATH

./scripts/code.sh --extensionDevelopmentPath=$ROOT/extensions/notebook --extensionTestsPath=$ROOT/extensions/notebook/out/integrationTest --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --remote-debugging-port=9222
./scripts/code.sh --extensionDevelopmentPath=$ROOT/extensions/integration-tests --extensionTestsPath=$ROOT/extensions/integration-tests/out --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --remote-debugging-port=9222

rm -r -f $VSCODEUSERDATADIR
rm -r $VSCODEEXTDIR
