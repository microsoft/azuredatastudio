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
$ServerZipName = "azuredatastudio-server-darwin.zip"
$ServerZip = "$artifactsDir\darwin\server\$ServerZipName"
$ServerZipNameWeb = "azuredatastudio-server-darwin-web.zip"
$ServerZipWeb = "$artifactsDir\darwin\server\$ServerZipNameWeb"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality darwin archive $ZipName $Version true $Zip $CommitId

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality "server-darwin" archive $ServerZipName true $ServerZip $CommitId

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality "server-darwin-web" archive $ServerZipNameWeb true $ServerZipWeb $CommitId
