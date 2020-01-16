#!/usr/bin/env bash
set -e
REPO="$(pwd)"

# ensure drop directories exist
mkdir -p $REPO/.build/darwin/{archive,server}

# remove pkg from archive
if [[ "$SIGNED" == "true" ]]; then
	zip -d $REPO/.build/darwin/archive/azuredatastudio-darwin.zip "*.pkg"
fi

# package Remote Extension Host
pushd .. && mv azuredatastudio-reh-darwin azuredatastudio-server-darwin && zip -Xry $REPO/.build/darwin/server/azuredatastudio-server-darwin.zip azuredatastudio-server-darwin && popd

node build/azure-pipelines/common/copyArtifacts.js
