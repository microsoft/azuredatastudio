#!/bin/bash


if [[ "$OSTYPE" == "darwin"* ]] || [[ "$AGENT_OS" == "Darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

cd $ROOT

if [[ "$OSTYPE" == "darwin"* ]] || [[ "$AGENT_OS" == "Darwin"* ]]; then
	NAME=`node -p "require('./product.json').nameLong"`
	CODE="./.build/electron/$NAME.app/Contents/MacOS/Electron"
else
	NAME=`node -p "require('./product.json').applicationName"`
	CODE=".build/electron/$NAME"
fi

# Default to only running stable tests if test grep isn't set
if [[ "$ADS_TEST_GREP" == "" ]]; then
	echo Running stable tests only
	export ADS_TEST_GREP=@UNSTABLE@
	export ADS_TEST_INVERT_GREP=1
fi

CODE_ARGS=--grep %ADS_TEST_GREP%

if [[ "$ADS_TEST_INVERT_GREP" == "1" ]] || [[ "$ADS_TEST_INVERT_GREP" == "true" ]]; then
	set CODE_ARGS=$CODE_ARGS --invert
fi

# Node modules
test -d node_modules || yarn

# Get electron
node build/lib/electron.js || ./node_modules/.bin/gulp electron

# Unit Tests
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$AGENT_OS" == "Darwin"* ]]; then
	cd $ROOT ; ulimit -n 4096 ; \
		ELECTRON_ENABLE_LOGGING=1 \
		"$CODE" \
		test/electron/index.js $CODE_ARGS "$@"
else
	cd $ROOT ; \
		ELECTRON_ENABLE_LOGGING=1 \
		"$CODE" \
		test/electron/index.js $CODE_ARGS "$@"
fi
