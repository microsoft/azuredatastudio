#Download base image ubuntu 16.04
FROM ubuntu:16.04

# Update Software repository
RUN apt-get update

RUN apt-get install -y libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus libgtk-3-0

ADD ./ /opt/ads-server

RUN chmod +x /opt/ads-server/server.sh && chmod +x /opt/ads-server/node

CMD ["/opt/ads-server/server.sh"]

EXPOSE 8000:8000
EXPOSE 8001:8001
