param(
  [string]$RootPath = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

$requiredPages = @(
  'index.html',
  'lectures.html',
  'assignments.html',
  'attendance.html',
  'resources.html'
)

$ignoredDirs = @(
  '.git',
  '.github',
  'node_modules',
  'archive-duplicate',
  'Port-Engineering-Course-main'
)

$scriptRegex = '<script[^>]*class=["''][^"'']*\bpe-ai-meta\b[^"'']*["''][^>]*type=["'']application/json["''][^>]*>([\s\S]*?)</script>'

$hasError = $false
$validatedCount = 0

function Add-Issue {
  param([string]$Message)
  $script:hasError = $true
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Is-NonEmptyString {
  param($Value)
  return ($Value -is [string] -and $Value.Trim().Length -gt 0)
}

function Is-StringArray {
  param($Value)
  if ($null -eq $Value -or -not ($Value -is [System.Collections.IEnumerable])) {
    return $false
  }

  foreach ($item in $Value) {
    if (-not ($item -is [string])) {
      return $false
    }
  }

  return $true
}

function Get-RelativePathCompat {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $baseFull = [System.IO.Path]::GetFullPath($BasePath)
  $targetFull = [System.IO.Path]::GetFullPath($TargetPath)

  $basePrefix = $baseFull.TrimEnd('\\') + '\\'
  if ($targetFull.StartsWith($basePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $targetFull.Substring($basePrefix.Length)
  }

  return $targetFull
}

function Validate-Metadata {
  param(
    [pscustomobject]$Metadata,
    [string]$RelativePath
  )

  $issues = New-Object System.Collections.Generic.List[string]

  if ($null -eq $Metadata) {
    $issues.Add("${RelativePath}: metadata root must be a JSON object.")
    return $issues
  }

  if (-not (Is-NonEmptyString $Metadata.page)) {
    $issues.Add("${RelativePath}: 'page' must be a non-empty string.")
  }

  if ($null -ne $Metadata.facts -and -not (Is-StringArray $Metadata.facts)) {
    $issues.Add("${RelativePath}: 'facts' must be an array of strings.")
  }

  if ($null -ne $Metadata.quickAnswers) {
    if (-not ($Metadata.quickAnswers -is [System.Collections.IEnumerable])) {
      $issues.Add("${RelativePath}: 'quickAnswers' must be an array.")
    } else {
      $index = 0
      foreach ($qa in $Metadata.quickAnswers) {
        if ($null -eq $qa) {
          $issues.Add("${RelativePath}: quickAnswers[$index] must be an object.")
          $index++
          continue
        }

        if (-not (Is-StringArray $qa.keywords) -or @($qa.keywords).Count -eq 0) {
          $issues.Add("${RelativePath}: quickAnswers[$index].keywords must be a non-empty array of strings.")
        }

        if (-not (Is-NonEmptyString $qa.answer)) {
          $issues.Add("${RelativePath}: quickAnswers[$index].answer must be a non-empty string.")
        }

        $index++
      }
    }
  }

  if ($null -ne $Metadata.deadlines) {
    if (-not ($Metadata.deadlines -is [System.Collections.IEnumerable])) {
      $issues.Add("${RelativePath}: 'deadlines' must be an array.")
    } else {
      $index = 0
      foreach ($deadline in $Metadata.deadlines) {
        if ($null -eq $deadline) {
          $issues.Add("${RelativePath}: deadlines[$index] must be an object.")
          $index++
          continue
        }

        if (-not (Is-NonEmptyString $deadline.label)) {
          $issues.Add("${RelativePath}: deadlines[$index].label must be a non-empty string.")
        }

        if (-not (Is-NonEmptyString $deadline.due)) {
          $issues.Add("${RelativePath}: deadlines[$index].due must be a non-empty string.")
        }

        $index++
      }
    }
  }

  if ($null -ne $Metadata.links) {
    if (-not ($Metadata.links -is [System.Collections.IEnumerable])) {
      $issues.Add("${RelativePath}: 'links' must be an array.")
    } else {
      $index = 0
      foreach ($link in $Metadata.links) {
        if ($null -eq $link) {
          $issues.Add("${RelativePath}: links[$index] must be an object.")
          $index++
          continue
        }

        if (-not (Is-NonEmptyString $link.label)) {
          $issues.Add("${RelativePath}: links[$index].label must be a non-empty string.")
        }

        $index++
      }
    }
  }

  return $issues
}

foreach ($page in $requiredPages) {
  $fullPath = Join-Path $RootPath $page
  if (-not (Test-Path $fullPath)) {
    Add-Issue "Required page not found: $page"
  }
}

$htmlFiles = Get-ChildItem -Path $RootPath -Recurse -File -Filter *.html | Where-Object {
  $relative = Get-RelativePathCompat -BasePath $RootPath -TargetPath $_.FullName
  foreach ($dir in $ignoredDirs) {
    if ($relative -like "$dir\\*" -or $relative -eq $dir) {
      return $false
    }
  }
  return $true
}

foreach ($file in $htmlFiles) {
  $relativePath = Get-RelativePathCompat -BasePath $RootPath -TargetPath $file.FullName
  $content = Get-Content -Path $file.FullName -Raw
  $match = [regex]::Match($content, $scriptRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $isRequired = $requiredPages -contains $relativePath

  if (-not $match.Success) {
    if ($isRequired) {
      Add-Issue "Missing pe-ai-meta block in required page: $relativePath"
    }
    continue
  }

  $validatedCount++

  try {
    $metadata = $match.Groups[1].Value | ConvertFrom-Json
  } catch {
    Add-Issue "Invalid JSON in ${relativePath}: $($_.Exception.Message)"
    continue
  }

  $issues = Validate-Metadata -Metadata $metadata -RelativePath $relativePath
  if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
      Add-Issue $issue
    }
  } else {
    Write-Host "[OK] $relativePath" -ForegroundColor Green
  }
}

if ($validatedCount -eq 0) {
  Add-Issue 'No pe-ai-meta blocks were found in scanned HTML files.'
}

if ($hasError) {
  Write-Host "`nMetadata validation failed." -ForegroundColor Red
  exit 1
}

Write-Host "`nMetadata validation passed for $validatedCount page(s)." -ForegroundColor Green
exit 0
