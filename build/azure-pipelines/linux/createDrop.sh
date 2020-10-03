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

# # Publish Remote Extension Host
# LEGACY_SERVER_BUILD_NAME="azuredatastudio-reh-$PLATFORM_LINUX"
# SERVER_BUILD_NAME="azuredatastudio-server-$PLATFORM_LINUX"
# SERVER_TARBALL_FILENAME="azuredatastudio-server-$PLATFORM_LINUX.tar.gz"
# SERVER_TARBALL_PATH="$REPO/.build/linux/server/$SERVER_TARBALL_FILENAME"

# rm -rf $ROOT/azuredatastudio-server-*.tar.*
# (cd $ROOT && mv $LEGACY_SERVER_BUILD_NAME $SERVER_BUILD_NAME && tar --owner=0 --group=0 -czf $SERVER_TARBALL_PATH $SERVER_BUILD_NAME)

# # Publish Remote Extension Host (Web)
# LEGACY_SERVER_BUILD_NAME_WEB="azuredatastudio-reh-web-$PLATFORM_LINUX"
# SERVER_BUILD_NAME_WEB="azuredatastudio-server-$PLATFORM_LINUX-web"
# SERVER_TARBALL_FILENAME_WEB="azuredatastudio-server-$PLATFORM_LINUX-web.tar.gz"
# SERVER_TARBALL_PATH_WEB="$REPO/.build/linux/server/$SERVER_TARBALL_FILENAME_WEB"

# rm -rf $ROOT/azuredatastudio-server-*.tar.*
# (cd $ROOT && mv $LEGACY_SERVER_BUILD_NAME_WEB $SERVER_BUILD_NAME_WEB && tar --owner=0 --group=0 -czf $SERVER_TARBALL_PATH_WEB $SERVER_BUILD_NAME_WEB)

node build/azure-pipelines/common/copyArtifacts.js
