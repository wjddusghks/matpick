param(
  [string]$SourceDir = (Join-Path $PSScriptRoot "..\..\source-data\old-korean-100"),
  [string]$OutputJson = (Join-Path $PSScriptRoot "..\client\src\data\generated\old-korean-100.generated.json"),
  [string]$CoverOutput = (Join-Path $PSScriptRoot "..\client\public\source-covers\old-korean-100.jpg"),
  [string]$CoordinateOverrides = (Join-Path $PSScriptRoot "..\..\source-data\old-korean-100\coordinates.json"),
  [string]$CoverPublicPath = "/source-covers/old-korean-100.jpg"
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

function Normalize-HeaderText {
  param([string]$Value)

  return ((Normalize-Text $Value).ToLowerInvariant() -replace "[^a-z0-9가-힣]", "")
}

function Find-ColumnIndex {
  param(
    [string[]]$Headers,
    [string[]]$Candidates
  )

  $normalizedHeaders = $Headers | ForEach-Object { Normalize-HeaderText $_ }
  $normalizedCandidates = $Candidates | ForEach-Object { Normalize-HeaderText $_ }

  foreach ($candidate in $normalizedCandidates) {
    for ($index = 0; $index -lt $normalizedHeaders.Count; $index++) {
      if ([string]::IsNullOrWhiteSpace($normalizedHeaders[$index])) {
        continue
      }

      if ($normalizedHeaders[$index] -eq $candidate -or $normalizedHeaders[$index].Contains($candidate)) {
        return $index
      }
    }
  }

  return -1
}

function Get-CellValue {
  param(
    [object[]]$Row,
    [int]$Index,
    [int]$FallbackIndex = -1
  )

  $resolvedIndex = if ($Index -ge 0) { $Index } else { $FallbackIndex }
  if ($resolvedIndex -lt 0 -or $resolvedIndex -ge $Row.Count) {
    return ""
  }

  return Normalize-Text ([string]$Row[$resolvedIndex])
}

function Split-ListText {
  param(
    [string]$Value,
    [switch]$AllowSlash
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @()
  }

  $normalized = ($Value -replace "`r`n", "`n" -replace "`r", "`n").Trim()
  if ($normalized.Contains("`n")) {
    return $normalized.Split("`n", [System.StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object {
      Normalize-Text $_
    } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  if ($AllowSlash) {
    return $normalized.Split("/", [System.StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object {
      Normalize-Text $_
    } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  return @((Normalize-Text $normalized))
}

function Parse-MenuLine {
  param([string]$Value)

  $trimmed = Normalize-Text $Value
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    return $null
  }

  $priceMatch = [regex]::Match($trimmed, "\d[\d,]*\s*원?")
  $price = if ($priceMatch.Success) { Normalize-Text $priceMatch.Value } else { "" }
  $name = if ($priceMatch.Success) {
    Normalize-Text ($trimmed.Remove($priceMatch.Index, $priceMatch.Length))
  } else {
    $trimmed
  }

  if ([string]::IsNullOrWhiteSpace($name)) {
    $name = $trimmed
  }

  return @{
    name = $name
    price = $price
  }
}

function Build-MenuItems {
  param(
    [string]$RestaurantId,
    [string]$RepresentativeMenuRaw,
    [string]$MenuListRaw,
    [string]$PriceListRaw
  )

  $menuLines = Split-ListText -Value $MenuListRaw
  $priceLines = Split-ListText -Value $PriceListRaw

  if ($menuLines.Count -eq 0) {
    $menuLines = Split-ListText -Value $RepresentativeMenuRaw -AllowSlash
  }

  $menuItems = New-Object System.Collections.Generic.List[object]
  $seen = New-Object System.Collections.Generic.HashSet[string]

  for ($menuIndex = 0; $menuIndex -lt $menuLines.Count; $menuIndex++) {
    $parsedLine = Parse-MenuLine -Value $menuLines[$menuIndex]
    if ($null -eq $parsedLine) {
      continue
    }

    $explicitPrice = if ($menuIndex -lt $priceLines.Count) {
      Normalize-Text $priceLines[$menuIndex]
    } else {
      ""
    }

    $price = if ([string]::IsNullOrWhiteSpace($explicitPrice)) { $parsedLine.price } else { $explicitPrice }
    $dedupeKey = ("{0}|{1}" -f $parsedLine.name.ToLowerInvariant(), $price)
    if (-not $seen.Add($dedupeKey)) {
      continue
    }

    $menuItems.Add([ordered]@{
        id = "${RestaurantId}_menu_$($menuItems.Count + 1)"
        name = $parsedLine.name
        price = if ([string]::IsNullOrWhiteSpace($price)) { $null } else { $price }
        isSignature = ($menuItems.Count -eq 0)
      })
  }

  return $menuItems
}

function Get-RepresentativeMenuText {
  param(
    [string]$RepresentativeMenuRaw,
    [System.Collections.Generic.List[object]]$MenuItems
  )

  $normalizedRepresentative = Normalize-Text $RepresentativeMenuRaw
  if (-not [string]::IsNullOrWhiteSpace($normalizedRepresentative)) {
    $candidateMenus = Split-ListText -Value $normalizedRepresentative -AllowSlash | ForEach-Object {
      $parsed = Parse-MenuLine -Value $_
      if ($parsed) { $parsed.name }
    } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    if ($candidateMenus.Count -gt 0) {
      return (($candidateMenus | Select-Object -First 3) -join " / ")
    }
  }

  if ($MenuItems.Count -gt 0) {
    return (($MenuItems | Select-Object -First 3 | ForEach-Object { $_.name }) -join " / ")
  }

  return ""
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

function Get-CoordinateLookupKey {
  param(
    [string]$Name,
    [string]$Address
  )

  return ("{0}|{1}" -f (Normalize-Text $Name).ToLowerInvariant(), (Normalize-Text $Address).ToLowerInvariant())
}

function Load-CoordinateOverrides {
  param([string]$Path)

  $lookup = @{}
  if (-not (Test-Path $Path)) {
    return $lookup
  }

  $rawText = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  $raw = $rawText | ConvertFrom-Json
  if ($raw -is [System.Collections.IEnumerable] -and -not ($raw -is [string])) {
    foreach ($entry in $raw) {
      if ($null -eq $entry) { continue }
      $name = Normalize-Text ([string]$entry.name)
      $address = Normalize-Text ([string]$entry.address)
      $lat = 0.0
      $lng = 0.0
      [void][double]::TryParse(([string]$entry.lat), [ref]$lat)
      [void][double]::TryParse(([string]$entry.lng), [ref]$lng)
      if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($address)) { continue }
      if ($lat -eq 0 -or $lng -eq 0) { continue }
      $lookup[(Get-CoordinateLookupKey -Name $name -Address $address)] = @{
        lat = $lat
        lng = $lng
      }
    }
  }

  return $lookup
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

$ordinalColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("회차", "번호", "순번", "ordinal", "order", "ep", "episode")
$foundingYearColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("개업연도", "개업년도", "개업", "창업연도", "창업년도", "창업", "foundingyear")
$categoryColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("카테고리", "분류", "유형", "음식종류", "장르", "category")
$nameColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("식당명", "맛집명", "업체명", "상호", "가게명", "식당이름", "name")
$addressColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("주소", "위치", "도로명주소", "지번주소", "address")
$representativeMenuColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("대표메뉴", "대표메뉴명", "대표 메뉴", "시그니처", "signaturemenu")
$menuColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("메뉴목록", "메뉴리스트", "메뉴 목록", "상세메뉴", "메뉴명", "음식명", "menu")
$priceColumnIndex = Find-ColumnIndex -Headers $headerRow -Candidates @("가격목록", "가격리스트", "가격 목록", "메뉴가격", "가격", "price")

$sourceId = [string]$sourceMeta.id
$sourceName = $xlsxFile.BaseName
$coverPublicPath = $CoverPublicPath
$coordinateLookup = Load-CoordinateOverrides -Path $CoordinateOverrides

$restaurants = New-Object System.Collections.Generic.List[object]
$sourceLinks = New-Object System.Collections.Generic.List[object]

for ($rowIndex = 1; $rowIndex -lt $rows.Count; $rowIndex++) {
  $row = $rows[$rowIndex]
  if (-not $row -or $row.Count -eq 0) {
    continue
  }

  $ordinalRaw = Get-CellValue -Row $row -Index $ordinalColumnIndex -FallbackIndex 0
  $foundingYearRaw = Get-CellValue -Row $row -Index $foundingYearColumnIndex -FallbackIndex 1
  $category = Get-CellValue -Row $row -Index $categoryColumnIndex -FallbackIndex 2
  $name = Get-CellValue -Row $row -Index $nameColumnIndex -FallbackIndex 3
  $address = Get-CellValue -Row $row -Index $addressColumnIndex -FallbackIndex 4
  $representativeMenuRaw = Get-CellValue -Row $row -Index $representativeMenuColumnIndex -FallbackIndex 5
  $menuListRaw = Get-CellValue -Row $row -Index $menuColumnIndex
  $priceListRaw = Get-CellValue -Row $row -Index $priceColumnIndex

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
  $menuItems = Build-MenuItems -RestaurantId $restaurantId -RepresentativeMenuRaw $representativeMenuRaw -MenuListRaw $menuListRaw -PriceListRaw $priceListRaw
  $representativeMenu = Get-RepresentativeMenuText -RepresentativeMenuRaw $representativeMenuRaw -MenuItems $menuItems
  $coordinateOverride = $coordinateLookup[(Get-CoordinateLookupKey -Name $name -Address $address)]
  $lat = if ($coordinateOverride) { [double]$coordinateOverride.lat } else { 0 }
  $lng = if ($coordinateOverride) { [double]$coordinateOverride.lng } else { 0 }

  $restaurants.Add([ordered]@{
      id = $restaurantId
      name = $name
      region = Get-RegionFromAddress -Address $address
      address = $address
      category = $category
      representativeMenu = $representativeMenu
      lat = $lat
      lng = $lng
      imageUrl = ""
      foundingYear = $foundingYear
      menus = $menuItems
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
