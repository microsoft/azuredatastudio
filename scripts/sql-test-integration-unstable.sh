#!/bin/bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

cd $ROOT

export ADS_TEST_GREP="(.*@UNSTABLE@|integration test setup)"
export ADS_TEST_INVERT_GREP=0

echo Running UNSTABLE ADS Extension Integration tests

./scripts/sql-test-integration.sh
