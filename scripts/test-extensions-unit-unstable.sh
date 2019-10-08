#!/bin/bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

cd $ROOT

export ADS_TEST_GREP=@UNSTABLE@
export ADS_TEST_INVERT_GREP=
echo Running UNSTABLE Extension Tests

./scripts/test-extensions-unit.sh
