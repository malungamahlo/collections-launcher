<#
.SYNOPSIS
  Removes the Collections Launcher icon from .collectionLauncher files in Windows.

.DESCRIPTION
  Undoes install.ps1 for the current Windows user: removes the two registry
  keys it wrote under HKCU\Software\Classes and the copy of the icon in
  %LOCALAPPDATA%\CollectionsLauncher. If .collectionLauncher has since been
  registered to something else, that registration is left alone.

  Safe to run more than once, and when nothing was installed.
#>

$ErrorActionPreference = 'Stop'

$extension = '.collectionLauncher'
$progId = 'CollectionsLauncher.Collection'
$classes = 'HKCU:\Software\Classes'

$extensionKey = Join-Path $classes $extension
$progIdKey = Join-Path $classes $progId
$installFolder = Join-Path $env:LOCALAPPDATA 'CollectionsLauncher'
$icon = Join-Path $installFolder 'collection-file.ico'

if (Test-Path -LiteralPath $extensionKey) {
  $current = (Get-Item -LiteralPath $extensionKey).GetValue('')

  if ($current -eq $progId) {
    Remove-Item -LiteralPath $extensionKey -Recurse -Force -Confirm:$false
  } else {
    Write-Host "$extension is registered to '$current', not to Collections Launcher. Left as it is."
  }
}

if (Test-Path -LiteralPath $progIdKey) {
  Remove-Item -LiteralPath $progIdKey -Recurse -Force -Confirm:$false
}

if (Test-Path -LiteralPath $icon) {
  Remove-Item -LiteralPath $icon -Force -Confirm:$false
}

# Remove the folder only if nothing else is in it.
if ((Test-Path -LiteralPath $installFolder) -and -not (Get-ChildItem -LiteralPath $installFolder -Force)) {
  Remove-Item -LiteralPath $installFolder -Force -Confirm:$false
}

Add-Type -Namespace CollectionsLauncher -Name Shell -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int eventId, uint flags, System.IntPtr item1, System.IntPtr item2);
'@
[CollectionsLauncher.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "Done. $extension files no longer show the Collections Launcher icon for this Windows user."
