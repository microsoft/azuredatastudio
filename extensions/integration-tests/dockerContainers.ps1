# Get where docker is installed
$dockerPath = (where.exe docker) | Select-Object -First 1
$dockerDirectory = $dockerPath.Substring(0, $dockerPath.Length - 21)

Write-Output "Waiting for Docker Desktop to start..."
Start-Process -FilePath "$dockerDirectory\Docker Desktop.exe"
Write-Output "Starting Docker Desktop..."
Start-Sleep -Seconds 60
Write-Output "Switching Docker to Linux Containers"
Start-Process -FilePath "$dockerDirectory\DockerCli.exe" -ArgumentList '-SwitchLinuxEngine'
Write-Output "Starting SQL Servers..."
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=Password123!" -p 1434:1433 --name sql2017 -d mcr.microsoft.com/mssql/server:2017-latest
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=Password123!" -p 1435:1433 --name sql2019 -d mcr.microsoft.com/mssql/server:2019-latest
docker run --cap-add SYS_PTRACE -e 'ACCEPT_EULA=1' -e 'MSSQL_SA_PASSWORD=Password123!' -p 1436:1433 --name azuresqldb -d mcr.microsoft.com/azure-sql-edge
Write-Output "Done!"
