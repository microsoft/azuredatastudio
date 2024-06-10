# Check if Docker is installed
$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue

if (-not $dockerInstalled) {
	# Ask and get admin permission: TO DO~!!!!!!

    Write-Output "Docker is not installed. Installing Docker..."

    # Define the URL for the Docker Desktop installer
    $installerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

	$installerDirectory = "$env:USERPROFILE\DockerInstall\"
    $installerPath = Join-Path -Path $installerDirectory -ChildPath "DockerDesktopInstaller.exe"

    if (-not (Test-Path -Path $installerDirectory -PathType Container)) {
      Write-Output "Path doesn't exist, making path..."
      New-Item -Path $installerDirectory -ItemType Directory -Force
    }

    # Download the Docker Desktop installer
    Write-Output "Downloading Docker Desktop installer..."
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

    # Install Docker Desktop
    Write-Output "Installing Docker Desktop..."
	$errorLogPath = "$installerDirectory\error_log.txt"
    Start-Process -FilePath $installerPath -ArgumentList 'install --accept-license --backend=wsl-2' -PassThru -RedirectStandardError $errorLogPath

	$stillInstalling =  -not ((Get-Content -Path $errorLogPath -Tail 1) -like "*Installation succeeded*")
	while ($stillInstalling) {
		Write-Output "Still Installing..."
		Write-Output (Get-Content -Path $errorLogPath)
		Start-Sleep -Seconds 10
		$stillInstalling =  -not ((Get-Content -Path $errorLogPath -Tail 1) -like "*Installation succeeded*")
	}

    # Check if the Docker installation process is still running
    $isRunning = Get-Process -Name "DockerDesktopInstaller" -ErrorAction SilentlyContinue
    # If the Docker installation process is still running, forcibly terminate it
    if ($isRunning) {
        Stop-Process -Name "DockerDesktopInstaller" -Force
    }

	Write-Output "Installation completed."
} else {
    Write-Output "Docker is already installed."
}

Write-Output "Starting docker container script..."
$sql2017passname='$sql2017pass'
$sql2019passname='$sql2019pass'
$azuresqlpassname='$azuresqlpass'
Start-Process powershell.exe -ArgumentList "-Command $sql2017passname='$sql2017pass';$sql2019passname='$sql2019pass';$azuresqlpassname='$azuresqlpass';$PSScriptRoot\\dockerContainers.ps1" -Verb RunAs
