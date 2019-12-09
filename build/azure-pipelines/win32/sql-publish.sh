#!/usr/bin/env bash
set -e

EXE_NAME = "AzureDataStudioSetup.exe"
SYSTEM_EXE = ".build/win32-x64/system-setup/$EXE_NAME"
USER_EXE = ".build/win32-x64/user-setup/$EXE_NAME"
USER_EXE_NAME = "AzureDataStudioUserSetup.exe"
ZIP_NAME = "azuredatastudio-win32-x64.zip"
ZIP = ".build/win32-x64/archive/$ZIP_NAME"

PACKAGEJSON=`ls package.json`
VERSION=`node -p "require(\"$PACKAGEJSON\").version"`

ASSET_PLATFORM = "win32-x64"

node build/azure-pipelines/common/publish.js "$VSCODE_QUALITY" "$ASSET_PLATFORM-archive" archive "$ZIP_NAME" "$VERSION" true "$ZIP"

node build/azure-pipelines/common/publish.js "$VSCODE_QUALITY" "$ASSET_PLATFORM" setup "$EXE_NAME" "$VERSION" true "$SYSTEM_EXE"

node build/azure-pipelines/common/publish.js "$VSCODE_QUALITY" "$ASSET_PLATFORM-user" setup "$USER_EXE_NAME" "$VERSION" true "$USER_EXE"
