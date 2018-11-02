#!/bin/bash


if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))

	# On Linux with Electron 2.0.x running out of a VM causes
	# a freeze so we only enable this flag on macOS
	export ELECTRON_ENABLE_LOGGING=1
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

cd $ROOT

if [[ "$OSTYPE" == "darwin"* ]]; then
	NAME=`node -p "require('./product.json').nameLong"`
	CODE="./.build/electron/$NAME.app/Contents/MacOS/Electron"
else
	NAME=`node -p "require('./product.json').applicationName"`
	CODE=".build/electron/$NAME"
fi

# Node modules
test -d node_modules || yarn

# Get electron
node build/lib/electron.js || ./node_modules/.bin/gulp electron

# Unit Tests
export ELECTRON_RUN_AS_NODE=1
if [[ "$OSTYPE" == "darwin"* ]]; then
	cd $ROOT ; ulimit -n 4096 ; \
		"$CODE" \
		node_modules/mocha/bin/_mocha "$@"
else
	cd $ROOT ; \
		"$CODE" \
		node_modules/mocha/bin/_mocha "$@"
fi
