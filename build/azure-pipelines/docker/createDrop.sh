set -e
REPO="$(pwd)"
ROOT="$REPO/.."

SERVER_BUILD_NAME="azuredatastudio-server-$PLATFORM_LINUX"
SERVER_BUILD_NAME_WEB="azuredatastudio-server-$PLATFORM_LINUX-web"

# create docker
mkdir -p $REPO/.build/docker
docker build -t azuredatastudio-server -f $REPO/build/azure-pipelines/docker/Dockerfile $ROOT/$SERVER_BUILD_NAME
docker save azuredatastudio-server | gzip > $REPO/.build/docker/azuredatastudio-server-docker.tar.gz

# create docker web
docker build -t azuredatastudio-server-web -f $REPO/build/azure-pipelines/docker/Dockerfile $ROOT/$SERVER_BUILD_NAME_WEB
docker save azuredatastudio-server-web | gzip > $REPO/.build/docker/azuredatastudio-server-docker-web.tar.gz
