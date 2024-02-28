###############################################################################################
# $Description: This PowerShell script automatically downloads self-hosted integration runtime software, install it on windows local machine, and register it with your Azure Database Migration Service.
# $Id: SHIR-auto-configuration.ps1
# $Author: Team - Azure Database Migration Service
###############################################################################################

<#
.SYNOPSIS
Automatically configures SHIR on a Windows machine including downloading, installing Integration runtime,
and configuring IR with DMS.

.DESCRIPTION
The script downloads, installs and configures SHIR on a Windows machine.

.PARAMETER AdminPriv
(Optional) [switch] True if script is running with admin privileges else false.

.PARAMETER AuthKey1
(Optional) [string] First authentication key to register node to DMS.

.PARAMETER AuthKey2
(Optional) [string] Second authentication key to register node to DMS.
#>

param (
	[switch] $AdminPriv = $false,
	[string] $AuthKey1 = $null,
	[string] $AuthKey2 = $null
)

$timeStamp = [System.DateTime]::Now.ToString("yyyyMMddHHmmss")
# Unique script id for every run - Telemetry purpose
$Global:ScriptId = "Script-$timestamp"

# TODO: Auto populate
$Global:LatestIRVersion = [Version]"5.34.8675.1"

# Minimum NuGet version required to install Az.DataMigration module
$Global:MinRequiredNuGetVersion = [Version]"2.8.5.201"

# Log file path
$Global:Logfile = Join-Path $env:USERPROFILE "shir/shir-$timeStamp.log"

# Guid used to create a script lock (to disable concurrent script instances)
$Global:InstallationLockGUID = $MyInvocation.MyCommand.Name

################################### Main Script Block ##################################
$main = {
	$isFirstInstance = $false
	# Create a new Stopwatch object
	$stopwatch = New-Object System.Diagnostics.Stopwatch
	# Start the stopwatch
	$stopwatch.Start()

	# Create a log file
	try {
		New-Item -ItemType File -Path $Global:Logfile -Force | Out-Null
	}
	catch {
		Write-Host "Failed to create log file at $Global:Logfile.`nError: $($_.Exception.Message)" -ForegroundColor Red
		$Global:Logfile = $null
	}

	try {
		Write-OutputAndLog "Script ID: $($Global:ScriptId)`nDescription: This script automatically configures SHIR on a Windows machine including downloading, installing Integration runtime, and configuring IR with DMS."

		# Create a lock file so that only one instance of script can run at a time
		$isFirstInstance = Lock-ScriptInstance
		if ($isFirstInstance) {
			Install-IR
		}
	}
	catch {
		Write-ErrorAndLog "The script could not configure self-hosted integration runtime due to an internal exception. Please try again. `nError: $($_.Exception.Message)"
	}
	finally {
		# Only allow the first running instance to unlock the script
		if ($isFirstInstance) {
			Unlock-ScriptInstance
		}
		# Stop the stopwatch
		$stopwatch.Stop()

		# Write the total time taken
		Write-OutputAndLog ("Total time taken: {0}" -f $stopwatch.Elapsed.ToString("hh\h\:mm\m\:ss\s"))
		if ($null -ne $Global:Logfile) {
			Write-OutputAndLog ("Log file generated: " + $Global:Logfile)
		}
		Write-Host "Press Enter to continue..."
		$null = Read-Host
	}
}

################################### Download, Install and Configure IR ##################################
Function Install-IR {
	Write-OutputAndLog "Checking if Integration Runtime is already installed on this machine..."
	$installedIRVersion = Get-InstalledShirVersion

	if ($null -ne $installedIRVersion) {
		Write-OutputAndLog "Integration Runtime found: Version $installedIRVersion is installed on the machine."

		# Perform validation checks for installed IR
		# if ($installedIRVersion -ne $Global:LatestIRVersion) {
		# 	Write-ErrorAndLog "Installed Integration Runtime's version $($installedIRVersion) does not meet the version $($Global:LatestIRVersion) or above required for configuring."
		# 	return
		# }
		# Write-OutputAndLog "The installed Integration Runtime satisfies all requirements for successful configuration."

		if (-not (Test-InternetConnectivity)) {
			return
		}

		# Configure SHIR - Register IR with the auth key
		Register-IntegrationRuntime -AuthKey1 $AuthKey1 -AuthKey2 $AuthKey2
	}
	elseif (Test-CanInstallIR) {
		$downloadFolder = Join-Path (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path "SHIR-Installer"
		$downloadUrl = "aka.ms/downloadLatestIR"

		# Download the installer
		$packageDownloadPath = Get-Package -packageName "IntegrationRuntime_$Global:LatestIRVersion.msi" `
			-url $downloadUrl `
			-downloadFolder $downloadFolder `
			-Force

		# Installs the IR msi
		$installationWasSuccessful = Install-MsiPackage -packageName "IntegrationRuntime" `
			-packagePath $packageDownloadPath `
			-installationVerificationCallback { return $null -ne (Get-InstalledShirVersion) }

		if ($installationWasSuccessful) {
			# Configure SHIR - Register IR with the auth key
			Register-IntegrationRuntime -AuthKey1 $AuthKey1 -AuthKey2 $AuthKey2
		}
	}
}

################################### Pre-installation checks ##################################
Function Test-CanInstallIR {
	<#
    .DESCRIPTION
    Performs pre-installation checks to ensure that SHIR can be installed, if any check fails a terminating error is thrown.

    .OUTPUTS
    [bool]: True if pre-installation validation is passed else false.
    #>
	try {
		if (-not [Environment]::Is64BitOperatingSystem) {
			throw "Prerequisites are not met. 64-bit operating system is required."
		}
		if (-not (Test-DotNetVersion)) {
			throw "Prerequisites are not met. Dotnet version 4.7.2 or later is required. Please download the supported version from: https://dotnet.microsoft.com/en-us/download/dotnet-framework."
		}
		if ([string]::IsNullOrWhitespace($AuthKey1) -and [string]::IsNullOrWhitespace($AuthKey2)) {
			throw "Minimum one authentication key is required."
		}
	}
	catch {
		Write-ErrorAndLog -exception $_.Exception
		return $false
	}
	return $true
}

Function Test-DotNetVersion {
	<#
    .DESCRIPTION
    Checks if installed .NET Framework version >= 4.7.2.
    https://learn.microsoft.com/en-us/purview/manage-integration-runtimes
    https://learn.microsoft.com/en-us/dotnet/framework/migration-guide/how-to-determine-which-versions-are-installed

    .OUTPUTS
    [bool]: true if intalled .NET Framework version >= 4.7.2 else false
    #>
	return (Get-ItemPropertyValue -LiteralPath 'HKLM:SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release) -ge 461808
}

Function Get-InstalledShirVersion {
	<#
    .DESCRIPTION
    Gets the version of SHIR that is installed on the machine.

    .OUTPUTS
    SHIR version if SHIR is installed, else $null.
    #>
	$InstalledSoftware = Get-ChildItem "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
	foreach ($obj in $InstalledSoftware) {
		if ($obj.GetValue('DisplayName') -like "*Microsoft Integration Runtime*") {
			return $obj.GetValue('DisplayVersion')
		}
	}
	return $null
}

################################### Lock/Unlock Script Instance ##################################
Function Lock-ScriptInstance {
	<#
    .DESCRIPTION
    The function creates a lock file so that only one instance of the script can run at a time.
    Return false if already another powershell console has the lock using the script id, else true.
	Using file based locking since it is simpler, and does not have PowerShell version compatibility issues.

    .OUTPUTS
    [bool] True if locking was successful else false.
    #>
	$lockFile = Join-Path ([System.IO.Path]::GetTempPath()) "$($Global:InstallationLockGUID).lk"

	# Lock exists
	if (Test-Path $lockFile) {
		# If file exists then check if the process is open in powershell and still running
		$existingScriptProcessId = [int]::Parse((Get-Content -Path $lockFile))
		$existingScriptProcess = Get-Process -Id $existingScriptProcessId -ErrorAction SilentlyContinue

		# If it is null and not running in powershell then its safe to take a lock.
		# Else show error to user and ask them to close the existing powershell process.
		if ($null -eq $existingScriptProcess -or -not $existingScriptProcess.ProcessName -like “pwsh”) {
			Remove-Item -Path $lockFile -Force -ErrorAction SilentlyContinue | Out-Null
		}
		else {
			$errorMessage = "Invalid Operation: Only one instance of the script is allowed to run at a time." + `
				"Another powershell console with processid $existingScriptProcessId has a lock for installation." + `
				"If the last installation was aborted in middle, then please close the console or " + `
				"delete the file '$lockFile' to release the lock."

			Write-ErrorAndLog $errorMessage
			return $false
		}
	}

	# Lock acquired
	Write-OutputAndLog "Installation lock acquired."
	Set-Content -Path $lockFile -Value $PID -NoNewline
	return $true
}

Function Unlock-ScriptInstance {
	<#
    .DESCRIPTION
    The function releases the file lock taken by this instance of the powershell console using the script id,
    so that other instances of this script can be run.

    .OUTPUTS
    None
    #>
	$lockFile = Join-Path ([System.IO.Path]::GetTempPath()) "$($Global:InstallationLockGUID).lk"

	if (Test-Path $lockFile) {
		Write-OutputAndLog "Releasing installation lock..."
		Remove-Item -Path $lockFile -Force -ErrorAction SilentlyContinue | Out-Null
	}
}

############################### Write Output on the console and Log ##################################
Function Write-OutputAndLog {
	<#
    .DESCRIPTION
    Display the message on the console host and also log the message to the script log file.

    .OUTPUTS
    None.
    #>
	Param (
		# Progress message which needs to be logged
		[Parameter()]
		[string]$message
	)

	$logLine = ("{0}: INFO: " -f (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")) + $message
	$color = if ($message.EndsWith("...")) { "Yellow" } else { "Green" }
	Write-Host "$logLine" -ForegroundColor $color
	if ($null -ne $Global:Logfile) {
		Add-content $Global:Logfile -value $logLine
	}
}

############################## Write Error on the console and Log ##################################
Function Write-ErrorAndLog {
	<#
    .DESCRIPTION
    Display the error message on the console host and also log the error to the script log file.

    .OUTPUTS
    None.
    #>
	Param (
		# Error message which needs to be logged
		[Parameter()]
		[System.Exception] $message,
		# Exception instance which needs to be logged.
		[Parameter()]
		[System.Exception] $exception
	)

	if ($null -ne $message) {
		$logLine = ("{0}: ERROR: {1} `n{2}" -f ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")), $message, "For more information, refer documentation (aka.ms/single-click-SHIR).")
		Write-Host $logLine -ForegroundColor Red
		Write-LogFile -message $logLine
	}

	if ($null -ne $exception) {
		$logLine = "{0}: ERROR: {1} `n{2}" -f ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff"), ($exception.ToString()), "For more information, refer documentation (aka.ms/single-click-SHIR).")
		Write-Host $logLine -ForegroundColor Red
		Write-LogFile -message $logLine
	}
}

################################# Append to log file #####################################
Function Write-LogFile {
	<#
    .DESCRIPTION
    Append to script log file.

    .OUTPUTS
    None.
    #>
	Param (
		# Log message
		[Parameter()]
		[string]$message
	)

	if ($null -ne $Global:Logfile) {
		Add-content $Global:Logfile -value $message
	}
}

############################################ Utils ########################################
Function Get-Package {
	<#
    .DESCRIPTION
    Downloads the installer packages from the url to the local folder. If the installer is already downloaded, then the
    download is aborted unless the force flag is set to true.

    .OUTPUTS
    [string]: Path to the downloaded install package.
    #>
	Param(
		# Full name of the installer package file which will be saved
		[Parameter(Mandatory)]
		[string] $packageName,
		# Url from where to download the installer package
		[Parameter(Mandatory)]
		[string] $url,
		# Download folder where the installer package will be downloaded
		[Parameter(Mandatory)]
		[string] $downloadFolder,
		# Flag which defines if the installer should be downloaded even if it already exists
		[Parameter()]
		[switch] $force = $false
	)

	$packagePath = Join-Path $downloadFolder $packageName
	$shouldDownload = $true

	# If the package already exists then the download flag respects the force flag
	if (Test-Path -path $packagePath) {
		$shouldDownload = $force
	}

	if ($shouldDownload) {
		# Check for internet connection before going forward
		if (-not (Test-InternetConnectivity)) {
			return
		}

		if (Test-Path -Path $packagePath) {
			# Package already exists, force download
			Remove-Item -Path $packagePath | Out-Null
			Write-OutputAndLog "Successfully removed the cached package from the directory: $downloadFolder."
		}

		if (-not (Test-Path -Path $downloadFolder)) {
			# If folder does not exists then create
			New-Item $downloadFolder -ItemType Directory | Out-Null
			Write-OutputAndLog "Successfully created the directory: $downloadFolder."
		}

		Write-OutputAndLog "Downloading from url $url..."
		Write-OutputAndLog "Downloading $packageName package..."

		$stopwatch = New-Object System.Diagnostics.Stopwatch
		$stopwatch.Start()
		Invoke-WebRequest -Uri $url -OutFile $packagePath
		$stopwatch.Stop()

		Write-OutputAndLog "Package $packageName downloaded at $downloadFolder."
		Write-OutputAndLog ("Downloaded {0} bytes in {1}." -f (Get-Item $packagePath).length, $stopwatch.Elapsed.ToString("hh\h\:mm\m\:ss\s"))
	}
	else {
		# Display message that file already exists
		Write-OutputAndLog "Package $packageName found at $downloadFolder."
	}

	return $packagePath
}

Function Test-InternetConnectivity {
	<#
    .DESCRIPTION
    Checks the internet connection by pinging known sites and stops execution if internet connection is
    not available.

    .OUTPUTS
    $true if the connection is available, otherwise $false
    #>
	Param (
		[Parameter(Mandatory = $false)]
		# Microsoft NCSI url for testing internet connectivity
		[string]$Url = "http://www.msftncsi.com/ncsi.txt"
	)

	try {
		$response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction SilentlyContinue
		if ($null -ne $response) {
			Write-OutputAndLog "Checking for internet connection... Completed."
			return $true
		}
		Write-ErrorAndLog "Prerequisites are not met. Internet connectivity is required on the machine."
		return $false
	}
	catch {
		Write-ErrorAndLog "Prerequisites are not met. Internet connectivity is required on the machine."
		return $false
	}
}

###################################### Check admin access #####################################
Function Test-AdminAccess {
	<#
    .DESCRIPTION
    Checks if the user executing this script has admin access.

    .OUTPUTS
    [bool]: True if user executing the script has admin access else false.
    #>
	$currentUser = New-Object Security.Principal.WindowsPrincipal $([Security.Principal.WindowsIdentity]::GetCurrent())
	return $currentUser.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

#################################### Install an MSI package ###################################
Function Install-MsiPackage {
	<#
    .DESCRIPTION
    Installs the msi package and then verifies the installation.

    .OUTPUTS
    [bool]: True if installation was successful, else false
    #>
	Param(
		# Name of the package to be installed
		[Parameter(Mandatory)]
		[string] $packageName,
		# Full path of the package along with executable name
		[Parameter(Mandatory)]
		[string] $packagePath,
		# Function that checks if package is installed
		[Parameter(Mandatory)]
		[scriptblock] $installationVerificationCallback
	)

	try {
		# Check if the installation is already done
		Write-OutputAndLog "Checking existing installation of $packageName package..."
		try {
			$isPackageInstalled = & $installationVerificationCallback -ErrorAction SilentlyContinue
			if ($null -ne $isPackageInstalled -and $isPackageInstalled -eq $true) {
				Write-OutputAndLog "$packageName package is already installed."
				return $true
			}
			else {
				Write-OutputAndLog "$packageName package is not installed."
			}
		}
		catch {
			Write-ErrorAndLog -exception $_.Exception
			return $false
		}

		# Add necessary arguments to install quietly with no UI
		# For no UI /qn, basic UI /qb, reduced UI /qr, full UI /qf
		$argsx = @('/i', $packagePath, '/quiet', '/qb')

		# Execute installation process
		Write-OutputAndLog "Installing $packageName package..."

		$stopwatch = New-Object System.Diagnostics.Stopwatch
		$stopwatch.Start()
		$process = Start-Process msiexec -Wait -NoNewWindow -ErrorAction SilentlyContinue -ArgumentList $argsx
		$stopwatch.Stop()

		Write-OutputAndLog "MSI Installation process exited with code: $($process.ExitCode)"
		Write-OutputAndLog "Installation completed in $($stopwatch.Elapsed.ToString("hh\h\:mm\m\:ss\s"))."

		# No installation verification callback provided
		if ([string]::IsNullOrWhiteSpace($installationVerificationCallback.ToString())) {
			return $true
		}

		# Verifying the installation
		Write-OutputAndLog "Verifying $packageName installation..."
		try {
			$installationResult = & $installationVerificationCallback
			if ($installationResult -eq $true) {
				Write-OutputAndLog "$packageName installation verification successful."
				return $true
			}
		}
		catch {
			Write-ErrorAndLog "Failed to verify $packageName installation. Check for errors. Error: $($_.Exception.Message)"
			return $false
		}
	}
	catch {
		Write-ErrorAndLog -exception $_.Exception
		return $false
	}
	return $true
}

#################################### Register Node to DMS ###################################
Function Register-IntegrationRuntime {
	<#
    .DESCRIPTION
    Configures the SHIR with the auth key. It registers the IR to the DMS using the authentication keys.

    .OUTPUTS
    None.
    #>
	param (
		[Parameter()]
		[string]$AuthKey1,

		[Parameter()]
		[string]$AuthKey2
	)

	if ([string]::IsNullOrWhitespace($AuthKey1) -and [string]::IsNullOrWhitespace($AuthKey2)) {
		Write-ErrorAndLog "Minimum one authentication key is required."
		return
	}

	$azDataMigrationModule = Get-Module -ListAvailable -Name Az.DataMigration

	try {
		if (-not $azDataMigrationModule) {
			# Install the NugetProvider for Az.DataMigration
			$nuget = Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue

			if ($null -eq $nuget -or $nuget.Version -lt $Global:MinRequiredNuGetVersion) {
				Write-OutputAndLog "Installing NuGet Package Provider..."
				$stopwatch = New-Object System.Diagnostics.Stopwatch
				$stopwatch.Start()
				Install-PackageProvider -Name NuGet -MinimumVersion $Global:MinRequiredNuGetVersion -Force
				$stopwatch.Stop()
				Write-OutputAndLog "Installation completed in $($stopwatch.Elapsed.ToString("hh\h\:mm\m\:ss\s"))."
			}

			# Install the Az.DataMigration module
			Write-OutputAndLog "Installing Az.DataMigration Module..."
			$stopwatch = New-Object System.Diagnostics.Stopwatch
			$stopwatch.Start()
			Install-Module -Name Az.DataMigration -Force -AllowClobber
			$stopwatch.Stop()
			Write-OutputAndLog "Installation completed in $($stopwatch.Elapsed.ToString("hh\h\:mm\m\:ss\s"))."
		}
	}
	catch {
		Write-ErrorAndLog -exception $_.Exception
		return
	}

	# Try the first authentication key
	try {
		if (-not [string]::IsNullOrWhitespace($AuthKey1)) {
			Write-OutputAndLog "Trying the first authentication key..."
			Register-AzDataMigrationIntegrationRuntime -AuthKey $AuthKey1 *> $null
			Write-OutputAndLog "Registration successful with the first authentication key."
			return
		}
	}
	catch {
		Write-ErrorAndLog "Failed to register with the first authentication key. Error: $($_.Exception.Message)"
	}

	# Try the second authentication key
	try {
		if (-not [string]::IsNullOrWhitespace($AuthKey2)) {
			Write-OutputAndLog "Trying the second authentication key..."
			Register-AzDataMigrationIntegrationRuntime -AuthKey $AuthKey2 *> $null
			Write-OutputAndLog "Registration successful with the second authentication key."
			return
		}
	}
	catch {
		Write-ErrorAndLog "Failed to register with the second authentication key. Error: $($_.Exception.Message)"
	}
}

###################################### Main Execution #####################################
if (-not (Test-AdminAccess)) {
	if ($AdminPriv) {
		Write-ErrorAndLog -exception "Failed to gain admin privileges."
	}
	# Gain admin access by prompting the user, if the script is executed without admin privileges.
	else {
		$commandLineArgs = "-noprofile -noexit -executionpolicy unrestricted -file $($MyInvocation.MyCommand.Definition) -admin-priv"

		if (-not [string]::IsNullOrWhitespace($AuthKey1)) {
			$commandLineArgs += " -authKey1 $AuthKey1"
		}
		if (-not [string]::IsNullOrWhitespace($AuthKey2)) {
			$commandLineArgs += " -authKey2 $AuthKey2"
		}

		Start-Process powershell.exe -Verb RunAs -ArgumentList $commandLineArgs
	}
	exit
}

& $main
