Param(
	[string]$sourcesDir,
	[string]$artifactsDir,
	[string]$storageKey,
	[string]$documentDbKey
)

$env:AZURE_STORAGE_ACCESS_KEY_2 = $storageKey
$env:AZURE_DOCUMENTDB_MASTERKEY = $documentDbKey

$VersionJson = Get-Content -Raw -Path "$artifactsDir\version.json" | ConvertFrom-Json
$Version = $VersionJson.version
$Quality = $VersionJson.quality
$CommitId = $VersionJson.commit

$ZipName = "azuredatastudio-darwin.zip"
$Zip = "$artifactsDir\darwin\archive\$ZipName"
$UploadName = "azuredatastudio-macos-$Version"

If (-NOT ($Quality -eq "stable")) {
	$UploadName = "$UploadName-$Quality"
}

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality darwin archive "$UploadName.zip" $Version true $Zip $CommitId
