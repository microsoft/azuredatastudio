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
$Arch = "x64"

# Publish tarball
$PlatformLinux = "linux-$Arch"
$TarballFilename = "azuredatastudio-linux-$Arch.tar.gz"
$TarballPath = "$artifactsDir\linux\archive\$TarballFilename"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformLinux archive-unsigned $TarballFilename $Version true $TarballPath $CommitId

# Publish DEB
$PlatformDeb = "linux-deb-$Arch"
$DebFilename = "$(Get-ChildItem -File -Name $artifactsDir\linux\deb\amd64\deb\*.deb)"
$DebPath = "$artifactsDir\linux\deb\amd64\deb\$DebFilename"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformDeb package $DebFilename $Version true $DebPath $CommitId

# Publish RPM
$PlatformRpm = "linux-rpm-$Arch"
$RpmFilename = "$(Get-ChildItem -File -Name $artifactsDir\linux\rpm\x86_64\*.rpm)"
$RpmPath = "$artifactsDir\linux\rpm\x86_64\$RpmFilename"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformRpm package $RpmFilename $Version true $RpmPath $CommitId
