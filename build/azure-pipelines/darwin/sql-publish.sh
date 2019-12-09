#!/usr/bin/env bash
set -env

PACKAGEJSON=`ls package.json`
VERSION=`node -p "require(\"$PACKAGEJSON\").version"`

node build/azure-pipelines/common/publish.js \
	"$VSCODE_QUALITY" \
	darwin \
	archive \
	"azuredatastudio-darwin-$VSCODE_QUALITY.zip" \
	$VERSION \
	true \
	.build/darwin/archive/azuredatastudio-darwin.zip
