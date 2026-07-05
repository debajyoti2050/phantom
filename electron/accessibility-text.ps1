function Invoke-PhantomAccessibilityText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigJson
  )

  $started = Get-Date

  function Write-Result {
    param([hashtable]$Result)

    if (-not $Result.ContainsKey("durationMs")) {
      $Result.durationMs = [int]((Get-Date) - $started).TotalMilliseconds
    }

    $Result | ConvertTo-Json -Compress -Depth 6
  }

  try {
    $config = $ConfigJson | ConvertFrom-Json
    $maxChars = 8000
    if ($config.maxChars) {
      $maxChars = [Math]::Max(1, [Math]::Min([int]$config.maxChars, 20000))
    }

    $excludeProcessIds = New-Object "System.Collections.Generic.HashSet[int]"
    if ($config.excludeProcessId) {
      [void]$excludeProcessIds.Add([int]$config.excludeProcessId)
    }
    if ($config.excludeProcessIds) {
      foreach ($processId in $config.excludeProcessIds) {
        if ($processId) {
          [void]$excludeProcessIds.Add([int]$processId)
        }
      }
    }
    $excludedTitleFragment = ""
    if ($config.appName) {
      $excludedTitleFragment = [string]$config.appName
    }

    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes

    $nativeSource = @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class PhantomNativeMethods {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int processId);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextLength(IntPtr hWnd);
}
"@

    Add-Type -TypeDefinition $nativeSource

    function Get-WindowProcessId {
      param([IntPtr]$Hwnd)
      $processId = 0
      [void][PhantomNativeMethods]::GetWindowThreadProcessId($Hwnd, [ref]$processId)
      return $processId
    }

    function Get-WindowTitle {
      param([IntPtr]$Hwnd)
      $length = [PhantomNativeMethods]::GetWindowTextLength($Hwnd)
      if ($length -le 0) {
        return ""
      }

      $builder = New-Object System.Text.StringBuilder ($length + 1)
      [void][PhantomNativeMethods]::GetWindowText($Hwnd, $builder, $builder.Capacity)
      return $builder.ToString()
    }

    function Test-CandidateWindow {
      param([IntPtr]$Hwnd)

      if ($Hwnd -eq [IntPtr]::Zero) {
        return $false
      }
      if (-not [PhantomNativeMethods]::IsWindowVisible($Hwnd)) {
        return $false
      }

      $processId = Get-WindowProcessId $Hwnd
      if ($processId -le 0 -or $excludeProcessIds.Contains($processId)) {
        return $false
      }

      $title = Get-WindowTitle $Hwnd
      if (
        -not [string]::IsNullOrWhiteSpace($excludedTitleFragment) -and
        $title.IndexOf($excludedTitleFragment, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
      ) {
        return $false
      }
      return -not [string]::IsNullOrWhiteSpace($title)
    }

    function Get-TargetWindow {
      $foreground = [PhantomNativeMethods]::GetForegroundWindow()
      if (Test-CandidateWindow $foreground) {
        return $foreground
      }

      $script:targetWindow = [IntPtr]::Zero
      $callback = [PhantomNativeMethods+EnumWindowsProc]{
        param([IntPtr]$Hwnd, [IntPtr]$Param)

        if (Test-CandidateWindow $Hwnd) {
          $script:targetWindow = $Hwnd
          return $false
        }
        return $true
      }

      [void][PhantomNativeMethods]::EnumWindows($callback, [IntPtr]::Zero)
      return $script:targetWindow
    }

    $targetWindow = Get-TargetWindow
    if ($targetWindow -eq [IntPtr]::Zero) {
      Write-Result @{
        text = "";
        windowTitle = "";
        processId = 0;
        elementCount = 0;
        truncated = $false;
        error = "No active external window was found.";
      }
      return
    }

    $root = [System.Windows.Automation.AutomationElement]::FromHandle($targetWindow)
    if (-not $root) {
      Write-Result @{
        text = "";
        windowTitle = Get-WindowTitle $targetWindow;
        processId = Get-WindowProcessId $targetWindow;
        elementCount = 0;
        truncated = $false;
        error = "Windows UI Automation could not read the active window.";
      }
      return
    }

    $texts = New-Object "System.Collections.Generic.List[string]"
    $seen = New-Object "System.Collections.Generic.HashSet[string]"
    $script:charCount = 0
    $script:truncated = $false

    function Add-AccessibleText {
      param([string]$Value)

      if ([string]::IsNullOrWhiteSpace($Value) -or $script:truncated) {
        return
      }

      $clean = (($Value -replace "\s+", " ").Trim())
      if ($clean.Length -lt 2) {
        return
      }

      if (-not $seen.Add($clean)) {
        return
      }

      $remaining = $maxChars - $script:charCount
      if ($remaining -le 0) {
        $script:truncated = $true
        return
      }

      if ($clean.Length -gt $remaining) {
        $clean = $clean.Substring(0, $remaining)
        $script:truncated = $true
      }

      [void]$texts.Add($clean)
      $script:charCount += $clean.Length + 1
    }

    function Read-ElementText {
      param([System.Windows.Automation.AutomationElement]$Element)

      try {
        if ($Element.Current.IsOffscreen) {
          return
        }
      } catch {
      }

      try {
        Add-AccessibleText $Element.Current.Name
      } catch {
      }

      $valuePattern = $null
      try {
        if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
          Add-AccessibleText $valuePattern.Current.Value
        }
      } catch {
      }

      $textPattern = $null
      try {
        if ($Element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$textPattern)) {
          $remaining = [Math]::Max(1, $maxChars - $script:charCount)
          Add-AccessibleText $textPattern.DocumentRange.GetText($remaining)
        }
      } catch {
      }
    }

    Read-ElementText $root

    $elementCount = 0
    try {
      $elements = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Subtree,
        [System.Windows.Automation.Condition]::TrueCondition
      )
      $limit = [Math]::Min($elements.Count, 1200)
      for ($index = 0; $index -lt $limit; $index++) {
        if ($script:truncated) {
          break
        }
        $elementCount++
        Read-ElementText $elements.Item($index)
      }
    } catch {
    }

    $joined = ($texts -join "`n").Trim()
    if ($script:truncated -and -not $joined.EndsWith("[accessibility text truncated]")) {
      $joined = "$joined`n`n[accessibility text truncated]"
    }

    $title = ""
    try {
      $title = $root.Current.Name
    } catch {
      $title = Get-WindowTitle $targetWindow
    }

    Write-Result @{
      text = $joined;
      windowTitle = $title;
      processId = Get-WindowProcessId $targetWindow;
      elementCount = $elementCount;
      truncated = $script:truncated;
      error = $null;
    }
  } catch {
    Write-Result @{
      text = "";
      windowTitle = "";
      processId = 0;
      elementCount = 0;
      truncated = $false;
      error = $_.Exception.Message;
    }
  }
}
