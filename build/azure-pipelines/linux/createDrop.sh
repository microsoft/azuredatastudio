#!/usr/bin/env bash
set -e
REPO="$(pwd)"
ROOT="$REPO/.."

# Publish tarball
mkdir -p $REPO/.build/linux/{archive,server}
PLATFORM_LINUX="linux-x64"
BUILDNAME="azuredatastudio-$PLATFORM_LINUX"
BUILD="$ROOT/$BUILDNAME"
TARBALL_FILENAME="azuredatastudio-$PLATFORM_LINUX.tar.gz"
TARBALL_PATH="$REPO/.build/linux/archive/$TARBALL_FILENAME"

rm -rf $ROOT/code-*.tar.*
(cd $ROOT && tar -czf $TARBALL_PATH $BUILDNAME)

node build/azure-pipelines/common/copyArtifacts.js
