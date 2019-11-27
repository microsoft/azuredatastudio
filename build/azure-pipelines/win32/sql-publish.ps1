Param(
	[string]$sourcesDir,
	[string]$artifactsDir,
	[string]$storageKey,
	[string]$documentDbKey
)

$env:AZURE_STORAGE_ACCESS_KEY_2 = $storageKey
$env:AZURE_DOCUMENTDB_MASTERKEY = $documentDbKey

$ExeName = "AzureDataStudioSetup.exe"
$SystemExe = "$artifactsDir\$ExeName"
$UserExe = "$artifactsDir\user-setup\$ExeName"
$UserExeName = "AzureDataStudioUserSetup.exe"
$ZipName = "azuredatastudio-windows.zip"
$Zip = "$artifactsDir\$ZipName"

$VersionJson = Get-Content -Raw -Path "$artifactsDir\version.json" | ConvertFrom-Json
$Version = $VersionJson.version
$Quality = $VersionJson.quality
$CommitId = $VersionJson.commit

$assetPlatform = "win32-x64"

node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform-archive" archive $ZipName $Version true $Zip $CommitId

node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform" setup $ExeName $Version true $SystemExe $CommitId

node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform-user" setup $UserExeName $Version true $UserExe $CommitId
