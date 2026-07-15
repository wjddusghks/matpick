param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,
  [int]$TargetWidth = 768,
  [int]$JpegQuality = 82
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$dataPath = Join-Path $projectRoot "client\src\data\generated\sikgaek-baekban-trip.generated.json"
$outputDirectory = Join-Path $projectRoot "client\public\card-data\sikgaek-baekban-trip"

if (-not (Test-Path -LiteralPath $SourceDirectory -PathType Container)) {
  throw "Source directory not found: $SourceDirectory"
}

if (-not (Test-Path -LiteralPath $dataPath -PathType Leaf)) {
  throw "Dataset not found: $dataPath"
}

function Normalize-CardLabel {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }

  return $Value.Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant() `
    -replace '\([^)]*\)', '' `
    -replace '\s+', '' `
    -replace '[^0-9a-z\uAC00-\uD7A3]', ''
}

function Test-CompatibleLabel {
  param(
    [string]$CardLabel,
    [string]$RestaurantLabel
  )

  return $CardLabel -eq $RestaurantLabel `
    -or $CardLabel.EndsWith($RestaurantLabel) `
    -or $RestaurantLabel.EndsWith($CardLabel)
}

function Export-Jpeg {
  param(
    [string]$SourcePath,
    [string]$TargetPath
  )

  $sourceImage = [Drawing.Image]::FromFile($SourcePath)
  try {
    $width = [Math]::Min($TargetWidth, $sourceImage.Width)
    $height = [Math]::Max(1, [Math]::Round($sourceImage.Height * $width / $sourceImage.Width))
    $bitmap = New-Object Drawing.Bitmap($width, $height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
      $graphics = [Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([Drawing.Color]::White)
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($sourceImage, 0, 0, $width, $height)
      }
      finally {
        $graphics.Dispose()
      }

      $qualityParameter = New-Object Drawing.Imaging.EncoderParameter(
        [Drawing.Imaging.Encoder]::Quality,
        [long]$JpegQuality
      )
      $encoderParameters = New-Object Drawing.Imaging.EncoderParameters(1)
      $encoderParameters.Param[0] = $qualityParameter
      try {
        $jpegCodec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
          Where-Object MimeType -eq "image/jpeg" |
          Select-Object -First 1
        $bitmap.Save($TargetPath, $jpegCodec, $encoderParameters)
      }
      finally {
        $qualityParameter.Dispose()
        $encoderParameters.Dispose()
      }
    }
    finally {
      $bitmap.Dispose()
    }
  }
  finally {
    $sourceImage.Dispose()
  }
}

Add-Type -AssemblyName System.Drawing

$datasetText = [IO.File]::ReadAllText($dataPath, [Text.Encoding]::UTF8)
$dataset = $datasetText | ConvertFrom-Json
$restaurants = @($dataset.restaurants)
$cardFiles = @(
  Get-ChildItem -LiteralPath $SourceDirectory -File -Filter "*.png" |
    ForEach-Object {
      if ($_.Name -notmatch '^(\d{3})_(.+)\.png$') {
        throw "Unexpected card filename: $($_.Name)"
      }

      [pscustomobject]@{
        Number = [int]$Matches[1]
        Label = $Matches[2]
        NormalizedLabel = Normalize-CardLabel $Matches[2]
        FullName = $_.FullName
        Name = $_.Name
        Modified = $_.LastWriteTimeUtc
      }
    }
)

$usedPaths = New-Object 'Collections.Generic.HashSet[string]'
$matches = New-Object 'Collections.Generic.List[object]'

for ($index = 0; $index -lt $restaurants.Count; $index += 1) {
  $restaurant = $restaurants[$index]
  $ordinal = $index + 1
  $normalizedName = Normalize-CardLabel $restaurant.name
  $candidates = @(
    $cardFiles | Where-Object {
      -not $usedPaths.Contains($_.FullName) -and
      (Test-CompatibleLabel $_.NormalizedLabel $normalizedName)
    }
  )

  if ($candidates.Count -eq 0) {
    throw "No card matched restaurant $ordinal ($($restaurant.id)): $($restaurant.name)"
  }

  $sameNumberCandidates = @($candidates | Where-Object Number -eq $ordinal)
  if ($sameNumberCandidates.Count -gt 0) {
    $selected = $sameNumberCandidates | Sort-Object Modified -Descending | Select-Object -First 1
  }
  else {
    $selected = $candidates |
      Sort-Object @{ Expression = { [Math]::Abs($_.Number - $ordinal) } }, @{ Expression = { $_.Modified }; Descending = $true } |
      Select-Object -First 1
  }

  [void]$usedPaths.Add($selected.FullName)
  $imageUrl = "/card-data/sikgaek-baekban-trip/$($restaurant.id).jpg"
  $matches.Add([pscustomobject]@{
    Restaurant = $restaurant
    Ordinal = $ordinal
    Card = $selected
    ImageUrl = $imageUrl
  })
}

if ($matches.Count -ne $restaurants.Count) {
  throw "Matched $($matches.Count) cards for $($restaurants.Count) restaurants."
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$converted = 0
foreach ($match in $matches) {
  $targetPath = Join-Path $outputDirectory "$($match.Restaurant.id).jpg"
  Export-Jpeg -SourcePath $match.Card.FullName -TargetPath $targetPath
  $converted += 1

  if ($converted % 50 -eq 0 -or $converted -eq $matches.Count) {
    Write-Host "Converted $converted/$($matches.Count) cards"
  }
}

foreach ($match in $matches) {
  $escapedId = [Regex]::Escape([string]$match.Restaurant.id)
  $pattern = '(?s)("id"\s*:\s*"' + $escapedId + '"\s*,.*?"imageUrl"\s*:\s*)"(?:[^"\\]|\\.)*"'
  $regex = New-Object Text.RegularExpressions.Regex($pattern)
  $replacement = '$1"' + $match.ImageUrl + '"'
  $updatedText = $regex.Replace($datasetText, $replacement, 1)

  if ($updatedText -eq $datasetText) {
    throw "Could not update imageUrl for $($match.Restaurant.id)"
  }

  $datasetText = $updatedText
}

[IO.File]::WriteAllText($dataPath, $datasetText, (New-Object Text.UTF8Encoding($true)))

$outputFiles = Get-ChildItem -LiteralPath $outputDirectory -File -Filter "*.jpg"
$totalBytes = ($outputFiles | Measure-Object Length -Sum).Sum
$unusedCards = $cardFiles.Count - $usedPaths.Count

Write-Host "Imported $($matches.Count) cards."
Write-Host "Unused source variants: $unusedCards"
Write-Host ("Output size: {0:N1} MB" -f ($totalBytes / 1MB))
