# Source Data

This folder stores raw source-specific files before they are normalized into
the app dataset.

Recommended structure:

```text
source-data/
  old-korean-100/
    source.json
    restaurants.xlsx
    cover.jpg
```

Current workflow:

1. Put each source in its own folder.
2. Keep the raw Excel file in that folder.
3. Keep the source cover image in the same folder.
4. Run the matching import script to generate app data.
5. Commit both the raw source files and the generated app data.

Notes:

- Different sources can keep different Excel column structures.
- Imported JSON files are generated into `matpick_all/client/src/data/generated/`.
- Source cover images are copied into `matpick_all/client/public/source-covers/`.
- For the old-korean-100 source, use:
  `matpick_all/scripts/import-old-korean-100.ps1`
