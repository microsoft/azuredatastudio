#Download base image ubuntu 22.04
FROM mcr.microsoft.com/mirror/docker/library/ubuntu:22.04
ENV TZ=America/Los_Angeles
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Update Software repository
RUN apt-get update && apt-get upgrade -y

RUN apt-get install -y libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 \
        libkrb5-dev git apt-transport-https ca-certificates curl gnupg-agent software-properties-common \
        libnss3 libasound2 make gcc libx11-dev fakeroot rpm libgconf-2-4 libunwind8 g++  python3-dev python3-pip

ADD ./ /opt/ads-server

RUN chmod +x /opt/ads-server/server.sh && chmod +x /opt/ads-server/node

CMD ["/opt/ads-server/server.sh"]

EXPOSE 8000:8000
EXPOSE 8001:8001
