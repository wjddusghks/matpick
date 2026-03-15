param(
  [string]$SourceDir = (Join-Path $PSScriptRoot "..\..\source-data\old-korean-100"),
  [string]$OutputJson = (Join-Path $PSScriptRoot "..\client\src\data\generated\old-korean-100.generated.json"),
  [string]$CoverOutput = (Join-Path $PSScriptRoot "..\client\public\source-covers\old-korean-100.jpg")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-EntryText {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchive]$Zip,
    [Parameter(Mandatory = $true)]
    [string]$EntryName
  )

  $entry = $Zip.GetEntry($EntryName)
  if (-not $entry) {
    return $null
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Close()
  }
}

function Get-XlsxRows {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $workbook = [xml](Read-EntryText -Zip $zip -EntryName "xl/workbook.xml")
    $rels = [xml](Read-EntryText -Zip $zip -EntryName "xl/_rels/workbook.xml.rels")
    $sharedText = Read-EntryText -Zip $zip -EntryName "xl/sharedStrings.xml"

    $sharedStrings = @()
    if ($sharedText) {
      $shared = [xml]$sharedText
      $sharedNs = [System.Xml.XmlNamespaceManager]::new($shared.NameTable)
      $sharedNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      $sis = $shared.SelectNodes("//x:si", $sharedNs)
      foreach ($si in $sis) {
        $parts = @()
        $tNodes = $si.SelectNodes(".//x:t", $sharedNs)
        foreach ($node in $tNodes) {
          $parts += $node.InnerText
        }
        $sharedStrings += ($parts -join "")
      }
    }

    $wbNs = [System.Xml.XmlNamespaceManager]::new($workbook.NameTable)
    $wbNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $wbNs.AddNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")

    $sheet = $workbook.SelectSingleNode("//x:sheets/x:sheet", $wbNs)
    if (-not $sheet) {
      throw "No sheet found in workbook."
    }

    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")

    $relsNs = [System.Xml.XmlNamespaceManager]::new($rels.NameTable)
    $relsNs.AddNamespace("x", "http://schemas.openxmlformats.org/package/2006/relationships")
    $rel = $rels.SelectSingleNode("//x:Relationship[@Id='$rid']", $relsNs)
    if (-not $rel) {
      throw "Could not resolve first worksheet relationship."
    }

    $target = "xl/" + $rel.Target
    $sheetXml = [xml](Read-EntryText -Zip $zip -EntryName $target)
    $sheetNs = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
    $sheetNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

    $rows = @()
    $rowNodes = $sheetXml.SelectNodes("//x:sheetData/x:row", $sheetNs)
    foreach ($rowNode in $rowNodes) {
      $row = @()
      $cellNodes = $rowNode.SelectNodes("./x:c", $sheetNs)
      foreach ($cell in $cellNodes) {
        $cellType = $cell.GetAttribute("t")
        $valueNode = $cell.SelectSingleNode("./x:v", $sheetNs)
        $inlineNode = $cell.SelectSingleNode("./x:is/x:t", $sheetNs)

        if ($cellType -eq "s" -and $valueNode) {
          $row += $sharedStrings[[int]$valueNode.InnerText]
        } elseif ($cellType -eq "inlineStr" -and $inlineNode) {
          $row += $inlineNode.InnerText
        } elseif ($valueNode) {
          $row += $valueNode.InnerText
        } else {
          $row += ""
        }
      }

      $rows += ,@($row)
    }

    return $rows
  } finally {
    $zip.Dispose()
  }
}

function Normalize-Text {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return ($Value -replace "\s+", " ").Trim()
}

function Get-RegionFromAddress {
  param([string]$Address)

  $normalized = Normalize-Text $Address
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return ""
  }

  $tokens = $normalized.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
  if ($tokens.Length -ge 2) {
    return ($tokens[0..1] -join " ")
  }

  return $normalized
}

$sourceDirPath = [System.IO.Path]::GetFullPath($SourceDir)
$sourceMetaPath = Join-Path $sourceDirPath "source.json"
if (-not (Test-Path $sourceMetaPath)) {
  throw "source.json not found: $sourceMetaPath"
}

$sourceMeta = Get-Content -Raw -Path $sourceMetaPath | ConvertFrom-Json
$xlsxFile = Get-ChildItem -Path $sourceDirPath -Filter *.xlsx | Select-Object -First 1
if (-not $xlsxFile) {
  throw "No xlsx file found in $sourceDirPath"
}

$rows = Get-XlsxRows -Path $xlsxFile.FullName
if ($rows.Count -lt 2) {
  throw "The source Excel file does not contain data rows."
}

$headerRow = $rows[0]
if ($headerRow.Count -lt 5) {
  throw "The source Excel file must contain at least five columns."
}

$sourceId = [string]$sourceMeta.id
$sourceName = $xlsxFile.BaseName
$coverPublicPath = "/source-covers/old-korean-100.jpg"

$restaurants = New-Object System.Collections.Generic.List[object]
$sourceLinks = New-Object System.Collections.Generic.List[object]

for ($rowIndex = 1; $rowIndex -lt $rows.Count; $rowIndex++) {
  $row = $rows[$rowIndex]
  if (-not $row -or $row.Count -eq 0) {
    continue
  }

  $ordinalRaw = if ($row.Count -gt 0) { Normalize-Text $row[0] } else { "" }
  $foundingYearRaw = if ($row.Count -gt 1) { Normalize-Text $row[1] } else { "" }
  $category = if ($row.Count -gt 2) { Normalize-Text $row[2] } else { "" }
  $name = if ($row.Count -gt 3) { Normalize-Text $row[3] } else { "" }
  $address = if ($row.Count -gt 4) { Normalize-Text $row[4] } else { "" }

  if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($address)) {
    continue
  }

  $ordinalNumber = 0
  [void][int]::TryParse($ordinalRaw, [ref]$ordinalNumber)
  $ordinalLabel = if ($ordinalNumber -gt 0) { $ordinalNumber.ToString("D3") } else { ($rowIndex).ToString("D3") }

  $foundingYear = $null
  $foundingYearValue = 0
  if ([int]::TryParse($foundingYearRaw, [ref]$foundingYearValue)) {
    $foundingYear = $foundingYearValue
  }

  $restaurantId = "${sourceId}_restaurant_${ordinalLabel}"

  $restaurants.Add([ordered]@{
      id = $restaurantId
      name = $name
      region = Get-RegionFromAddress -Address $address
      address = $address
      category = $category
      representativeMenu = ""
      lat = 0
      lng = 0
      imageUrl = ""
      foundingYear = $foundingYear
      menus = @()
      thumbnailFileName = $null
      isOverseas = $false
    })

  $sourceLinks.Add([ordered]@{
      id = "${sourceId}_link_${ordinalLabel}"
      restaurantId = $restaurantId
      sourceId = $sourceId
      ordinal = if ($ordinalNumber -gt 0) { $ordinalNumber } else { $null }
      label = $sourceName
      note = if ($foundingYear) { "Founded in $foundingYear" } else { "" }
    })
}

$output = [ordered]@{
  restaurants = $restaurants
  sources = @(
    [ordered]@{
      id = $sourceId
      name = $sourceName
      type = [string]$sourceMeta.type
      provider = [string]$sourceMeta.provider
      description = "$sourceName data"
      imageUrl = $coverPublicPath
    }
  )
  sourceLinks = $sourceLinks
}

$outputDir = Split-Path -Parent $OutputJson
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$output | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $OutputJson

$coverSourceFile = Get-ChildItem -Path (Join-Path $sourceDirPath "*") -Include *.jpg,*.jpeg,*.png -File | Select-Object -First 1
if ($coverSourceFile) {
  $coverOutputDir = Split-Path -Parent $CoverOutput
  if (-not (Test-Path $coverOutputDir)) {
    New-Item -ItemType Directory -Path $coverOutputDir | Out-Null
  }
  Copy-Item -Path $coverSourceFile.FullName -Destination $CoverOutput -Force
}

Write-Output "Generated: $OutputJson"
Write-Output "Restaurants: $($restaurants.Count)"
Write-Output "Source links: $($sourceLinks.Count)"
