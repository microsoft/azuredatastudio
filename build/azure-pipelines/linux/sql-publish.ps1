. build/azure-pipelines/win32/exec.ps1
$ErrorActionPreference = "Stop"

$VersionJson = Get-Content -Raw -Path "$artifactsDir\version.json" | ConvertFrom-Json
$Version = $VersionJson.version
$Quality = $VersionJson.quality
$CommitId = $VersionJson.commit
$Arch = "x64"

# Publish tarball
$PlatformLinux = "linux-$Arch"
$TarballFilename = "azuredatastudio-linux-$Arch.tar.gz"
$TarballPath = "$artifactsDir\$TarballFilename"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformLinux archive-unsigned $TarballFilename $Version true $TarballPath $CommitId

# Publish DEB
$PlatformDeb = "linux-deb-$Arch"
$DebFilename = "$(Get-ChildItem -File -Name $artifactsDir\*.deb)"
$DebPath = "$artifactsDir\$DebFilename"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformDeb package $DebFilename $Version true $DebPath $CommitId

# Publish RPM
$PlatformRpm = "linux-rpm-$Arch"
$RpmFilename = "$(Get-ChildItem -File -Name $artifactsDir\*.rpm)"
$RpmPath = "$artifactsDir\$RpmFilename"

node $sourcesDir\build\azure-pipelines\common\publish.js $Quality $PlatformRpm package $RpmFilename $Version true $RpmPath $CommitId
