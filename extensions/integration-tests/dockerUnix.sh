#!/bin/bash

echo "Waiting for Docker Desktop to start..."

# Open Docker Desktop, check the operating system
if [ "$(uname)" == "Darwin" ]; then
	open -a Docker
elif [ "$(uname)" == "Linux" ]; then
	systemctl --user start docker-desktop
else
	echo "Unsupported operating system: $(uname)"
	exit 1
fi

echo "Starting Docker Desktop..."
sleep 60


echo "Starting SQL Servers..."

# Stop and remove existing containers
docker stop sql2017integrationtestdb
docker rm sql2017integrationtestdb
docker stop sql2019integrationtestdb
docker rm sql2019integrationtestdb
docker stop azuresqlintegrationtestdb
docker rm azuresqlintegrationtestdb

# Run new SQL Server containers
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=$sql2017pass" -p 1434:1433 --name sql2017integrationtestdb -d mcr.microsoft.com/mssql/server:2017-latest
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=$sql2019pass" -p 1435:1433 --name sql2019integrationtestdb -d mcr.microsoft.com/mssql/server:2019-latest
docker run --cap-add SYS_PTRACE -e "ACCEPT_EULA=1" -e "MSSQL_SA_PASSWORD=$azuresqlpass" -p 1436:1433 --name azuresqlintegrationtestdb -d mcr.microsoft.com/azure-sql-edge

echo "Done!"
