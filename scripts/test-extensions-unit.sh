#!/bin/bash

# Runs unit tests for Extensions
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

cd $ROOT
echo $VSCODEUSERDATADIR
echo $VSCODEEXTDIR

echo starting admin tool extension windows tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/admin-tool-ext-win --extensionTestsPath=$ROOT/extensions/admin-tool-ext-win/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting agent tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/agent --extensionTestsPath=$ROOT/extensions/agent/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting azurecore tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/azurecore --extensionTestsPath=$ROOT/extensions/azurecore/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting cms tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/cms --extensionTestsPath=$ROOT/extensions/cms/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting dacpac tests
./scripts/code.sh --extensionDevelopmentPath=$ROOT/extensions/dacpac --extensionTestsPath=$ROOT/extensions/dacpac/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting schema compare tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/schema-compare --extensionTestsPath=$ROOT/extensions/schema-compare/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting notebook tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/notebook --extensionTestsPath=$ROOT/extensions/notebook/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR
echo starting resource deployment tests
./scripts/code.sh --nogpu --extensionDevelopmentPath=$ROOT/extensions/resource-deployment --extensionTestsPath=$ROOT/extensions/resource-deployment/out/test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR

rm -r $VSCODEUSERDATADIR
rm -r $VSCODEEXTDIR
