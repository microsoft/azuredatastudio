# PowerShell script to delete all yarn.lock files in the workspace

# Find all yarn.lock files in the workspace
$yarnLockFiles = Get-ChildItem -Path "." -Filter "yarn.lock" -Recurse -File

Write-Host "Found $($yarnLockFiles.Count) yarn.lock files to delete."

foreach ($file in $yarnLockFiles) {
    Write-Host "Deleting $($file.FullName)..."

    # Delete the file
    Remove-Item -Path $file.FullName -Force

    if (Test-Path -Path $file.FullName) {
        Write-Host "Failed to delete $($file.FullName)" -ForegroundColor Red
    } else {
        Write-Host "Successfully deleted $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "Completed deleting yarn.lock files."
