# Get where docker is installed
$dockerDirectory = (Get-Command docker).Source
$dockerDirectory = $dockerDirectory.Substring(0, $dockerDirectory.Length - "\resources\bin\docker.exe".Length)

Write-Output "Waiting for Docker Desktop to start..."
Start-Process -FilePath "$dockerDirectory\Docker Desktop.exe"
Write-Output "Starting Docker Desktop..."
Start-Sleep -Seconds 60
Write-Output "Switching Docker to Linux Containers"
Start-Process -FilePath "$dockerDirectory\DockerCli.exe" -ArgumentList '-SwitchLinuxEngine'
Write-Output "Starting SQL Servers..."
docker stop sql2017integrationtestdb
docker rm sql2017integrationtestdb
docker stop sql2019integrationtestdb
docker rm sql2019integrationtestdb
docker stop azuresqlintegrationtestdb
docker rm azuresqlintegrationtestdb
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=$sql2017pass" -p 1434:1433 --name sql2017integrationtestdb -d mcr.microsoft.com/mssql/server:2017-latest
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=$sql2019pass" -p 1435:1433 --name sql2019integrationtestdb -d mcr.microsoft.com/mssql/server:2019-latest
docker run --cap-add SYS_PTRACE -e 'ACCEPT_EULA=1' -e "MSSQL_SA_PASSWORD=$azuresqlpass" -p 1436:1433 --name azuresqlintegrationtestdb -d mcr.microsoft.com/azure-sql-edge
Write-Output "Done!"
