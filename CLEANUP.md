Cleanup recommendations for this workspace

- There are duplicate copies of the site under `Port-Engineering-Course-main/Port-Engineering-Course-main/`.
- I updated both the top-level files and the main nested copies to be consistent.

Recommended next steps (manual):
1. Inspect `Port-Engineering-Course-main/Port-Engineering-Course-main/` to confirm whether it's a duplicate backup.
2. If duplicate, remove or move it to an `archive/` folder to avoid confusion:
   - To remove: `git rm -r "Port-Engineering-Course-main/Port-Engineering-Course-main" && git commit -m "Remove duplicate folder"`
   - To archive: `git mv "Port-Engineering-Course-main/Port-Engineering-Course-main" ./archive/duplicate-site`
3. Verify all links after cleanup and push changes.

If you want, I can perform the archive/delete step now (I will not delete without your confirmation).