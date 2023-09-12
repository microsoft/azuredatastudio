# Download base image ubuntu 20.04
FROM mcr.microsoft.com/mirror/docker/library/ubuntu:20.04

# Adding apt repos for g++-7
RUN echo "deb http://dk.archive.ubuntu.com/ubuntu/ bionic main" >> /etc/apt/sources.list
RUN echo "deb http://dk.archive.ubuntu.com/ubuntu/ bionic universe" >> /etc/apt/sources.list

# Set timezone to avoid blocking prompts on docker build
ENV TZ=America/Los_Angeles
RUN ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
RUN echo "$TZ" > /etc/timezone

RUN apt-get update
RUN apt-get install -y tzdata

# Update Software repository
RUN apt-get update && apt-get upgrade -y

RUN apt-get install -y libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 \
	libkrb5-dev git apt-transport-https ca-certificates curl gnupg-agent software-properties-common \
	libnss3 libasound2 make gcc libx11-dev fakeroot rpm libgconf-2-4 libunwind8 g++-7 libgbm-dev wget


# make GCC 7 the default compiler
RUN rm /usr/bin/gcc
RUN ln -s /usr/bin/gcc-7 /usr/bin/gcc
RUN ln -s /usr/bin/g++-7 /usr/bin/g++

# Adding Libssl for dotnet 5.0 and ESRP signing to work
RUN wget -c http://security.ubuntu.com/ubuntu/pool/main/o/openssl1.0/libssl1.0.0_1.0.2n-1ubuntu5_amd64.deb
RUN dpkg -i libssl1.0.0_1.0.2n-1ubuntu5_amd64.deb

# docker
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
