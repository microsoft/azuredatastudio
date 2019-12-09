#!/usr/bin/env bash
set -e
REPO="$(pwd)"
ROOT="$REPO/.."

PLATFORM_LINUX="linux-x64"
PACKAGEJSON="package.json"
VERSION=$(node -p "require(\"$PACKAGEJSON\").version")
TARBALL_FILENAME="azuredatastudio-$PLATFORM_LINUX.tar.gz"
TARBALL_PATH="$REPO/.build/linux/archive/$TARBALL_FILENAME"

node build/azure-pipelines/common/publish.js "$VSCODE_QUALITY" "$PLATFORM_LINUX" archive-unsigned "$TARBALL_FILENAME" "$VERSION" true "$TARBALL_PATH"

# Publish DEB
PLATFORM_DEB="linux-deb-x64"
DEB_ARCH="amd64"
DEB_FILENAME="$(ls $REPO/.build/linux/deb/$DEB_ARCH/deb/)"
DEB_PATH="$REPO/.build/linux/deb/$DEB_ARCH/deb/$DEB_FILENAME"

node build/azure-pipelines/common/publish.js "$VSCODE_QUALITY" "$PLATFORM_DEB" package "$DEB_FILENAME" "$VERSION" true "$DEB_PATH"

# Publish RPM
PLATFORM_RPM="linux-rpm-x64"
RPM_ARCH="x86_64"
RPM_FILENAME="$(ls $REPO/.build/linux/rpm/$RPM_ARCH/ | grep .rpm)"
RPM_PATH="$REPO/.build/linux/rpm/$RPM_ARCH/$RPM_FILENAME"

node build/azure-pipelines/common/publish.js "$VSCODE_QUALITY" "$PLATFORM_RPM" package "$RPM_FILENAME" "$VERSION" true "$RPM_PATH"
