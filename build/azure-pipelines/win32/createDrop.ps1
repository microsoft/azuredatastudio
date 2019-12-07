. build/azure-pipelines/win32/exec.ps1
$ErrorActionPreference = "Stop"

$Arch = "x64"

$Repo = "$(pwd)"
$Root = "$Repo\.."
$LegacyServer = "$Root\azuredatastudio-reh-win32-$Arch"
$ServerName = "azuredatastudio-server-win32-$Arch"
$Server = "$Root\$ServerName"
$ServerZipLocation = "$Repo\.build\win32-$Arch\server"
$ServerZip = "$ServerZipLocation\azuredatastudio-server-win32-$Arch.zip"

# Create server archive
exec { mkdir -p $ServerZipLocation } "Make Directory"
exec { Rename-Item -Path $LegacyServer -NewName $ServerName } "Rename Item"
exec { .\node_modules\7zip\7zip-lite\7z.exe a -tzip $ServerZip $Server -r } "Zip Server"

exec { node build/azure-pipelines/common/copyArtifacts.js } "Copy Artifacts"
