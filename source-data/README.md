# Source Data

This folder stores raw source-specific data files before they are normalized
into the app dataset.

Recommended structure:

```text
source-data/
  old-korean-100/
    source.json
    한국인이 사랑하는 오래된 한식당 100선.xlsx
    한국인이 사랑하는 오래된 한식당 100선.jpg
```

Notes:

- Keep one folder per source.
- Raw Excel files can keep their own column formats.
- Images can live next to the Excel file for now.
- Later updates can be made by replacing the Excel/image files in the same
  folder and pushing to GitHub.
