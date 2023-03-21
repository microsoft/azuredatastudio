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

$Archs = "x64","arm64"
$DebDirectories = "amd64","arm64"
$RpmDirectories = "x86_64","aarch64"
$FileNameArchTags = "","-arm64"

For($i = 0; $i -lt $Archs.Length; $i++)
{
	$Arch = $Archs[$i]
	$FileNameArchTag = $FileNameArchTags[$i]

	# Publish tarball
	$PlatformLinux = "linux-$Arch"
	$TarballFilename = "azuredatastudio-linux-$Arch.tar.gz"
	$TarballPath = "$artifactsDir\linux\archive\$TarballFilename"
	$TarballUploadName = "azuredatastudio-linux$FileNameArchTag-$Version"

	If (-NOT ($Quality -eq "stable")) {
		$TarballUploadName = "$TarballUploadName-$Quality"
	}

	node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformLinux archive-unsigned "$TarballUploadName.tar.gz" $Version true $TarballPath $CommitId

	# Publish DEB
	$DebDirectory = $DebDirectories[$i]
	$PlatformDeb = "linux-deb-$Arch"
	$DebFilename = "$(Get-ChildItem -File -Name $artifactsDir\linux\deb\$DebDirectory\deb\*.deb)"
	$DebPath = "$artifactsDir\linux\deb\$DebDirectory\deb\$DebFilename"
	$DebUploadName = "azuredatastudio-linux$FileNameArchTag-$Version"

	If (-NOT ($Quality -eq "stable")) {
		$DebUploadName = "$DebUploadName-$Quality"
	}

	node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformDeb package "$DebUploadName.deb" $Version true $DebPath $CommitId

	# Publish RPM
	$RpmDirectory = $RpmDirectories[$i]
	$PlatformRpm = "linux-rpm-$Arch"
	$RpmFilename = "$(Get-ChildItem -File -Name $artifactsDir\linux\rpm\$RpmDirectory\*.rpm)"
	$RpmPath = "$artifactsDir\linux\rpm\$RpmDirectory\$RpmFilename"
	$RpmUploadName = "azuredatastudio-linux$FileNameArchTag-$Version"

	If (-NOT ($Quality -eq "stable")) {
		$RpmUploadName = "$RpmUploadName-$Quality"
	}

	node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformRpm package "$RpmUploadName.rpm" $Version true $RpmPath $CommitId
}
