param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,
  [int]$TargetWidth = 768,
  [int]$JpegQuality = 82
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$dataPath = Join-Path $projectRoot "client\src\data\generated\wednesday-gourmet.generated.json"
$outputDirectory = Join-Path $projectRoot "client\public\card-data\wednesday-gourmet"

if (-not (Test-Path -LiteralPath $SourceDirectory -PathType Container)) {
  throw "Source directory not found: $SourceDirectory"
}

if (-not (Test-Path -LiteralPath $dataPath -PathType Leaf)) {
  throw "Dataset not found: $dataPath"
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
  Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File -Filter "*.png" |
    ForEach-Object {
      if ($_.Name -notmatch '^(\d{3})_.+\.png$') {
        throw "Unexpected card filename: $($_.Name)"
      }

      [pscustomobject]@{
        Number = [int]$Matches[1]
        FullName = $_.FullName
        Name = $_.Name
      }
    }
)

$duplicates = @($cardFiles | Group-Object Number | Where-Object Count -gt 1)
if ($duplicates.Count -gt 0) {
  throw "Duplicate card numbers: $($duplicates.Name -join ', ')"
}

$expectedNumbers = @(1..$restaurants.Count)
$actualNumbers = @($cardFiles.Number | Sort-Object)
$missingNumbers = @($expectedNumbers | Where-Object { $_ -notin $actualNumbers })
$unexpectedNumbers = @($actualNumbers | Where-Object { $_ -notin $expectedNumbers })

if ($missingNumbers.Count -gt 0 -or $unexpectedNumbers.Count -gt 0) {
  throw "Card number mismatch. Missing: $($missingNumbers -join ', '); Unexpected: $($unexpectedNumbers -join ', ')"
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

for ($index = 0; $index -lt $restaurants.Count; $index += 1) {
  $restaurant = $restaurants[$index]
  $ordinal = $index + 1
  $card = $cardFiles | Where-Object Number -eq $ordinal | Select-Object -First 1
  $targetPath = Join-Path $outputDirectory "$($restaurant.id).jpg"
  Export-Jpeg -SourcePath $card.FullName -TargetPath $targetPath

  $imageUrl = "/card-data/wednesday-gourmet/$($restaurant.id).jpg"
  $escapedId = [Regex]::Escape([string]$restaurant.id)
  $pattern = '(?s)("id"\s*:\s*"' + $escapedId + '"\s*,.*?"imageUrl"\s*:\s*)"(?:[^"\\]|\\.)*"'
  $regex = New-Object Text.RegularExpressions.Regex($pattern)
  $replacement = '$1"' + $imageUrl + '"'
  $updatedText = $regex.Replace($datasetText, $replacement, 1)

  if ($updatedText -eq $datasetText) {
    throw "Could not update imageUrl for $($restaurant.id)"
  }

  $datasetText = $updatedText

  if ($ordinal % 50 -eq 0 -or $ordinal -eq $restaurants.Count) {
    Write-Host "Imported $ordinal/$($restaurants.Count) cards"
  }
}

[IO.File]::WriteAllText($dataPath, $datasetText, (New-Object Text.UTF8Encoding($true)))

$outputFiles = @(Get-ChildItem -LiteralPath $outputDirectory -File -Filter "*.jpg")
$totalBytes = ($outputFiles | Measure-Object Length -Sum).Sum

Write-Host "Imported $($outputFiles.Count) cards."
Write-Host ("Output size: {0:N1} MB" -f ($totalBytes / 1MB))
