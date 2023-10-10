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

$Flavors = "x64","arm64","universal"
$FlavorSuffixes = "","-arm64","-universal"

For($i = 0; $i -lt $Flavors.Length; $i++)
{
	$Flavor = $Flavors[$i]
	$FlavorSuffix = $FlavorSuffixes[$i]
	$ZipName = "azuredatastudio-darwin-$Flavor.zip"
	$Zip = "$artifactsDir\darwin\archive\$ZipName"
	$UploadName = "azuredatastudio-macos$FlavorSuffix-$Version"

	If (-NOT ($Quality -eq "stable")) {
		$UploadName = "$UploadName-$Quality"
	}

	$Platform = "darwin$FlavorSuffix"

	node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $Platform archive "$UploadName.zip" $Version true $Zip $CommitId
}
