Param(
	[string]$sourcesDir,
	[string]$artifactsDir,
	[string]$storageKey,
	[string]$documentDbKey
)

$env:AZURE_STORAGE_ACCESS_KEY_2 = $storageKey
$env:AZURE_DOCUMENTDB_MASTERKEY = $documentDbKey

$ExeName = "AzureDataStudioSetup.exe"
$SystemExe = "$artifactsDir\win32-x64\system-setup\$ExeName"
$UserExe = "$artifactsDir\win32-x64\user-setup\$ExeName"
$UserExeName = "AzureDataStudioUserSetup.exe"
$ZipName = "azuredatastudio-win32-x64.zip"
$Zip = "$artifactsDir\win32-x64\archive\$ZipName"

$VersionJson = Get-Content -Raw -Path "$artifactsDir\version.json" | ConvertFrom-Json
$Version = $VersionJson.version
$Quality = $VersionJson.quality
$CommitId = $VersionJson.commit

$ZipUploadName = "azuredatastudio-windows-$Version"
$SetupUploadName = "azuredatastudio-windows-setup-$Version"
$UserUploadName = "azuredatastudio-windows-user-setup-$Version"

$assetPlatform = "win32-x64"

If (-NOT ($Quality -eq "stable")) {
	$ZipUploadName = "$ZipUploadName-$Quality"
	$SetupUploadName = "$SetupUploadName-$Quality"
	$UserUploadName = "$UserUploadName-$Quality"
}

node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform-archive" archive "$ZipUploadName.zip" $Version true $Zip $CommitId

node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform" setup "$SetupUploadName.exe" $Version true $SystemExe $CommitId

node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform-user" setup "$UserUploadName.exe" $Version true $UserExe $CommitId
