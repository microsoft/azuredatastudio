. build/azure-pipelines/win32/exec.ps1
$ErrorActionPreference = "Stop"

$Arch = "x64"

$Repo = "$(pwd)"
$Root = "$Repo\.."
$LegacyServer = "$Root\azuredatastudio-reh-win32-$Arch"
$LegacyServerWeb = "$Root\azuredatastudio-reh-web-win32-$Arch"
$ServerName = "azuredatastudio-server-win32-$Arch"
$ServerNameWeb = "azuredatastudio-server-win32-$Arch-web"
$Server = "$Root\$ServerName"
$ServerWeb = "$Root\$ServerNameWeb"
$ServerZipLocation = "$Repo\.build\win32-$Arch\server"
$ServerZip = "$ServerZipLocation\azuredatastudio-server-win32-$Arch.zip"
$ServerZipWeb = "$ServerZipLocation\azuredatastudio-server-win32-$Arch-web.zip"

# Create server archive
New-Item $ServerZipLocation -ItemType Directory # this will throw even when success for we don't want to exec this
$global:LASTEXITCODE = 0
exec { Rename-Item -Path $LegacyServer -NewName $ServerName } "Rename Item"
exec { .\node_modules\7zip\7zip-lite\7z.exe a -tzip $ServerZip $Server -r } "Zip Server"

# Create server archive (web)
# exec { Rename-Item -Path $LegacyServerWeb -NewName $ServerNameWeb }
# exec { .\node_modules\7zip\7zip-lite\7z.exe a -tzip $ServerZipWeb $ServerWeb -r }

exec { node build/azure-pipelines/common/copyArtifacts.js } "Copy Artifacts"
