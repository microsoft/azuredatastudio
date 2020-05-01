# Runs Extension tests

[CmdletBinding()]
param (
	[Parameter(Mandatory=$false)]
	[Alias("Extension")]
	[ValidateSet(
		"admin-tool-ext-win",
		"agent",
		"azurecore",
		"cms",
		"dacpac",
		"schema-compare",
		#"mssql",
		"notebook",
		"resource-deployment",
		"machine-learning-services",
		"sql-database-projects")]
	[string[]] $Extensions
)

If ($Extensions.Length -eq 0)
{
	$Extensions = (Get-Variable "Extensions").Attributes.ValidValues
	Write-Host "No extensions specified.  Defaulting to all ($($Extensions.Count))."
}

# setlocal equivalent?

Push-Location "$PSScriptRoot\\.."

$tempDirSuffix = "$(Get-Random)-$(Get-Date -Format "ss.ff")"
$VSCODEUSERDATADIR = "$env:TEMP\\adsuser-$tempDirSuffix"
$VSCODEEXTENSIONSDIR = "$env:TEMP\\adsext-$tempDirSuffix"

Write-Host $VSCODEUSERDATADIR
Write-Host $VSCODEEXTENSIONSDIR

# Figure out which Electron to use for running tests
If ([string]::IsNullOrEmpty($env:INTEGRATION_TEST_ELECTRON_PATH))
{
	# Run out of sources: no need to compile as code.bat takes care of it
	$env:INTEGRATION_TEST_ELECTRON_PATH=".\\scripts\\code.bat"
	Write-Host "Running unit tests out of sources.";
} Else
{
	# Run from a build: need to compile all test extensions
	ForEach ($ext in $Extensions)
	{
		&"yarn" gulp compile-extension:$ext
	}

	Write-Host "Running unit tests with '$env:INTEGRATION_TEST_ELECTRON_PATH' as build."
}

# Default to only running stable tests if test grep isn't set
If ([string]::IsNullOrEmpty($env:ADS_TEST_GREP))
{
	Write-Host "Running stable tests only"

	$env:ADS_TEST_GREP = "@UNSTABLE@"
	$env:ADS_TEST_INVERT_GREP = 1
}

ForEach ($ext in $Extensions)
{
	Write-Host $("*" * ($ext.Length + 23))
	Write-Host "*** starting $ext tests ***"
	Write-Host $("*" * ($ext.Length + 23))

	$args = "--extensionDevelopmentPath=$PSScriptRoot\..\extensions\$ext --extensionTestsPath=$PSScriptRoot\..\extensions\$ext\out\test --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTENSIONSDIR --remote-debugging-port=9222 --disable-telemetry --disable-crash-reporter --disable-updates --nogpu"
	Write-Host "$env:INTEGRATION_TEST_ELECTRON_PATH $args"

	#&"$env:INTEGRATION_TEST_ELECTRON_PATH" $args
}

If ($LASTEXITCODE -ne 0)
{
	Return $LASTEXITCODE
}

Remove-Item $VSCODEUSERDATADIR -Recurse -Force
Remove-Item $VSCODEEXTENSIONSDIR -Recurse -Force

Pop-Location

# endlocal equivalent?
