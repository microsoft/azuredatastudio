Param(
	[string]$sourcesDir,
	[string]$artifactsDir,
	[string]$storageKey,
	[string]$documentDbKey
)

$env:AZURE_STORAGE_ACCESS_KEY_2 = $storageKey
$env:AZURE_DOCUMENTDB_MASTERKEY = $documentDbKey

$Flavors = "x64","arm64"
$FlavorSuffixes = "","-arm64"

For($i = 0; $i -lt $Flavors.Length; $i++)
{
	$Flavor = $Flavors[$i]
	$FlavorSuffix = $FlavorSuffixes[$i]
	$ExeName = "AzureDataStudioSetup.exe"
	$SystemExe = "$artifactsDir\win32-$Flavor\system-setup\$ExeName"
	$UserExe = "$artifactsDir\win32-$Flavor\user-setup\$ExeName"
	$UserExeName = "AzureDataStudioUserSetup.exe"
	$ZipName = "azuredatastudio-win32-$Flavor.zip"
	$Zip = "$artifactsDir\win32-$Flavor\archive\$ZipName"

	$VersionJson = Get-Content -Raw -Path "$artifactsDir\version.json" | ConvertFrom-Json
	$Version = $VersionJson.version
	$Quality = $VersionJson.quality
	$CommitId = $VersionJson.commit

	$ZipUploadName = "azuredatastudio-windows$FlavorSuffix-$Version"
	$SetupUploadName = "azuredatastudio-windows$FlavorSuffix-setup-$Version"
	$UserUploadName = "azuredatastudio-windows$FlavorSuffix-user-setup-$Version"

	$assetPlatform = "win32-$Flavor"

	If (-NOT ($Quality -eq "stable")) {
		$ZipUploadName = "$ZipUploadName-$Quality"
		$SetupUploadName = "$SetupUploadName-$Quality"
		$UserUploadName = "$UserUploadName-$Quality"
	}

	node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform-archive" archive "$ZipUploadName.zip" $Version true $Zip $CommitId

	node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform" setup "$SetupUploadName.exe" $Version true $SystemExe $CommitId

	node $sourcesDir/build/azure-pipelines/common/publish.js $Quality "$assetPlatform-user" setup "$UserUploadName.exe" $Version true $UserExe $CommitId
}
