#Download base image ubuntu 16.04
FROM ubuntu:16.04

# Update Software repository
RUN apt-get update && apt-get upgrade -y

RUN apt-get install -y libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 \
	libkrb5-dev git apt-transport-https ca-certificates curl gnupg-agent software-properties-common \
	libnss3 libasound2 make gcc libx11-dev fakeroot rpm libgconf-2-4 libunwind8 g++-4.8

RUN rm /usr/bin/gcc
RUN rm /usr/bin/g++
RUN ln -s /usr/bin/gcc-4.8 /usr/bin/gcc
RUN ln -s /usr/bin/g++-4.8 /usr/bin/g++

#docker
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
RUN apt-key fingerprint 0EBFCD88
RUN add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
RUN apt-get update
RUN apt-get -y install docker-ce docker-ce-cli containerd.io

# This image needs to be built on a linux host; some weird stuff happens and the xvfb service won't start
# if built on a windows host.
ADD ./xvfb.init /etc/init.d/xvfb
RUN chmod +x /etc/init.d/xvfb
RUN update-rc.d xvfb defaults
