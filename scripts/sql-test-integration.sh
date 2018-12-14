#!/bin/bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
	VSCODEUSERDATADIR=`mktemp -d -t 'myuserdatadir'`
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
	VSCODEUSERDATADIR=`mktemp -d 2>/dev/null`
fi

cd $ROOT

# Tests in the extension host

./scripts/code.sh $ROOT/extensions/integration-tests/test --extensionDevelopmentPath=$ROOT/extensions/integration-tests --extensionTestsPath=$ROOT/extensions/integration-tests/out --user-data-dir=$VSCODEUSERDATADIR --skip-getting-started

rm -r $VSCODEUSERDATADIR
