#!/usr/bin/env bash
set -e
REPO="$(pwd)"

# ensure drop directories exist
mkdir -p $REPO/.build/darwin/{archive,server}

# package Remote Extension Host
# pushd .. && mv azuredatastudio-reh-darwin azuredatastudio-server-darwin && zip -Xry $REPO/.build/darwin/server/azuredatastudio-server-darwin.zip azuredatastudio-server-darwin && popd

# package Remote Extension Host (Web)
# pushd .. && mv azuredatastudio-reh-web-darwin azuredatastudio-server-darwin-web && zip -Xry $REPO/.build/darwin/server/azuredatastudio-server-darwin-web.zip azuredatastudio-server-darwin-web && popd

node build/azure-pipelines/common/copyArtifacts.js
