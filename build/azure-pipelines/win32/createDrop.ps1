. build/azure-pipelines/win32/exec.ps1
$ErrorActionPreference = "Stop"

$Arch = "x64"

$Repo = "$(pwd)"
$Root = "$Repo\.."
$LegacyServer = "$Root\azuredatastudio-reh-win32-$Arch"
$ServerName = "azuredatastudio-server-win32-$Arch"
$Server = "$Root\$ServerName"
$ServerZip = "$Repo\.build\win32-$Arch\server\azuredatastudio-server-win32-$Arch.zip"

# Create server archive
exec { Rename-Item -Path $LegacyServer -NewName $ServerName }
exec { .\node_modules\7zip\7zip-lite\7z.exe a -tzip $ServerZip $Server -r }

exec { node build/azure-pipelines/common/copyArtifacts.js }
