<#
.SYNOPSIS
  Shows the Collections Launcher icon on exported .collectionLauncher files in Windows.

.DESCRIPTION
  Windows chooses a file's icon from its type, so the type has to be registered
  on each computer; the extension cannot do that from inside the browser.

  This registers the type for the current Windows user only (under
  HKCU\Software\Classes; no administrator rights needed):

    .collectionLauncher                           -> CollectionsLauncher.Collection
    CollectionsLauncher.Collection                -> "Collections Launcher collection"
    CollectionsLauncher.Collection\DefaultIcon    -> the icon

  The icon is copied to %LOCALAPPDATA%\CollectionsLauncher first, so it keeps
  working if this folder is moved or deleted. Nothing is registered for
  opening the file: double-clicking it behaves as before.

  Safe to run more than once. Undo with uninstall.ps1.
#>

$ErrorActionPreference = 'Stop'

$extension = '.collectionLauncher'
$progId = 'CollectionsLauncher.Collection'
$typeName = 'Collections Launcher collection'
$classes = 'HKCU:\Software\Classes'

$source = Join-Path $PSScriptRoot 'collection-file.ico'
$installFolder = Join-Path $env:LOCALAPPDATA 'CollectionsLauncher'
$icon = Join-Path $installFolder 'collection-file.ico'

if (-not (Test-Path -LiteralPath $source)) {
  throw "The icon was not found at $source. Run 'npm run build:file-icon' in the project first."
}

# The extension may already belong to something else on this computer; leave it alone.
$extensionKey = Join-Path $classes $extension
$current = $null

if (Test-Path -LiteralPath $extensionKey) {
  $current = (Get-Item -LiteralPath $extensionKey).GetValue('')
}

if ($current -and $current -ne $progId) {
  throw "$extension files are already registered to '$current' for this user. Nothing was changed."
}

New-Item -ItemType Directory -Force -Path $installFolder | Out-Null
Copy-Item -LiteralPath $source -Destination $icon -Force

$progIdKey = Join-Path $classes $progId
$iconKey = Join-Path $progIdKey 'DefaultIcon'

New-Item -Path $extensionKey -Force | Out-Null
Set-Item -LiteralPath $extensionKey -Value $progId

New-Item -Path $progIdKey -Force | Out-Null
Set-Item -LiteralPath $progIdKey -Value $typeName

New-Item -Path $iconKey -Force | Out-Null
Set-Item -LiteralPath $iconKey -Value "`"$icon`",0"

# Tell Explorer that file associations changed, so icons refresh without signing out.
Add-Type -Namespace CollectionsLauncher -Name Shell -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int eventId, uint flags, System.IntPtr item1, System.IntPtr item2);
'@
[CollectionsLauncher.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "Done. $extension files now show the Collections Launcher icon for this Windows user."
Write-Host "Icon: $icon"
Write-Host 'If an icon already on screen has not changed, press F5 in that folder or sign out and back in.'
Write-Host 'To undo this, run uninstall.ps1 (or uninstall.cmd) in this folder.'
