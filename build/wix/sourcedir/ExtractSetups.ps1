# Extracts all azuredatastudio version that can be found in local directory.
#
# Example:
# - azuredatastudio-windows-1.24.0.zip

$files = Get-ChildItem | Where-Object { $_.Name -match "^azuredatastudio-windows-(?<version>\d+\.\d+\.\d+)\.zip$" }
$version = $($Matches.version)
$files | Foreach-Object {
  Expand-Archive -Path $_.Name -DestinationPath ".\$($version)\x64"
}
