set -e
REPO="$(pwd)"
ROOT="$REPO/.."

PLATFORM_LINUX="linux-x64"
SERVER_BUILD_NAME="azuredatastudio-server-$PLATFORM_LINUX"

# create docker
mkdir -p $REPO/.build/docker
docker build -t azuredatastudio-server -f $REPO/build/azure-pipelines/docker/Dockerfile $ROOT/$SERVER_BUILD_NAME
docker save azuredatastudio-server | gzip > $REPO/.build/docker/azuredatastudio-server-docker.tar.gz

node build/azure-pipelines/common/copyArtifacts.js
