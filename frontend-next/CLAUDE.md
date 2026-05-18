@AGENTS.md

--

Archive/uploads workflow
-----------------------

Use the `backend/scripts/archive_uploads.sh` script to create a compressed snapshot of `backend/uploads/`, ensure it's ignored, and commit the archive. Example:

```bash
# run without pushing to remote (safe)
./backend/scripts/archive_uploads.sh --no-push

# run and attempt push to remote (requires git remote + credentials)
./backend/scripts/archive_uploads.sh
```

The script is idempotent and will skip git steps when the workspace isn't a git repo.
