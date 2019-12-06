#!/usr/bin/env bash
set -e
REPO="$(pwd)"
ROOT="$REPO/.."

# Publish tarball
mkdir -p $REPO/.build/linux/{archive,server}
PLATFORM_LINUX="linux-x64"
BUILDNAME="azuredatastudio-$PLATFORM_LINUX"
BUILD="$ROOT/$BUILDNAME"
BUILD_VERSION="$(date +%s)"
[ -z "$VSCODE_QUALITY" ] && TARBALL_FILENAME="azuredatastudio-$BUILD_VERSION.tar.gz" || TARBALL_FILENAME="azuredatastudio-$VSCODE_QUALITY-$BUILD_VERSION.tar.gz"
TARBALL_PATH="$REPO/.build/linux/archive/$TARBALL_FILENAME"

rm -rf $ROOT/code-*.tar.*
(cd $ROOT && tar -czf $TARBALL_PATH $BUILDNAME)

# Publish Remote Extension Host
LEGACY_SERVER_BUILD_NAME="azuredatastudio-reh-$PLATFORM_LINUX"
SERVER_BUILD_NAME="azuredatastudio-server-$PLATFORM_LINUX"
SERVER_TARBALL_FILENAME="azuredatastudio-server-$PLATFORM_LINUX.tar.gz"
SERVER_TARBALL_PATH="$REPO/.build/linux/server/$SERVER_TARBALL_FILENAME"

rm -rf $ROOT/vscode-server-*.tar.*
(cd $ROOT && mv $LEGACY_SERVER_BUILD_NAME $SERVER_BUILD_NAME && tar --owner=0 --group=0 -czf $SERVER_TARBALL_PATH $SERVER_BUILD_NAME)

# create docker
mkdir -p $REPO/.build/docker
docker build -t azuredatastudio-server -f $REPO/build/azure-pipelines/docker/Dockerfile $ROOT/azuredatastudio-reh-linux-x64
docker save azuredatastudio-server | gzip > $REPO/.build/docker/azuredatastudio-server-docker.tar.gz

node build/azure-pipelines/common/copyArtifacts.js
