# Deployment Guide - Optimizing Repository Size

## Current Status

This repository has been optimized to reduce deployment size for platforms like Replit that have storage constraints.

### Changes Made

1. **Excluded Large Binary Files**: Added patterns to `.gitignore` for:
   - Video files (*.mov, *.MOV, *.MP4, *.mp4, etc.)
   - Machine learning models (*.bin, *.onnx, *.tflite, etc.)
   - CAD files (*.f3z, *.f3d, *.step, *.stl)
   - Large images in specific directories

2. **Removed Files from Tracking**: Removed ~331MB of large binary files from the current working tree

3. **Added Documentation**: Created README files in affected directories explaining where to obtain the removed files

## Deploying to Replit

### Option 1: Shallow Clone (Recommended)

Replit and other deployment platforms can use a shallow clone to significantly reduce repository size:

```bash
git clone --depth 1 https://github.com/Johnsonbros/omi.git
```

This clones only the latest commit without the full git history, reducing size by ~400MB+.

### Option 2: Configure Replit to Use Shallow Clone

In your Replit configuration, you can specify shallow clone depth. Add to `.replit`:

```toml
[deployment]
deploymentTarget = "autoscale"
run = ["bash", "start.sh"]
build = ["bash", "build.sh"]

[git]
shallow = true
depth = 1
```

### Option 3: Use .replitignore

Create a `.replitignore` file to exclude additional files from the Replit deployment:

```
.git/
docs/
attached_assets/
omiGlass/hardware/
omi/hardware/
*.md
!README.md
!DEPLOYMENT.md
```

## Further Size Optimization (Advanced)

If you need to reduce the repository size further by removing files from git history, you'll need to use `git filter-repo` or BFG Repo-Cleaner. **Warning: This rewrites git history and requires force pushing.**

### Using git filter-repo (Recommended)

```bash
# Install git filter-repo
pip install git-filter-repo

# Remove large files from history
git filter-repo --path-glob '*.mov' --path-glob '*.MOV' --path-glob '*.MP4' --invert-paths
git filter-repo --path-glob '*.bin' --invert-paths
git filter-repo --path 'plugins/hume-ai/video' --invert-paths
git filter-repo --path 'sdks/swift/Sources/omi-lib/Resources/ggml-tiny.en.bin' --invert-paths

# Force push to remote (requires admin permissions)
git push origin --force --all
```

### Using BFG Repo-Cleaner

```bash
# Download BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Remove files larger than 10MB from history
java -jar bfg-1.14.0.jar --strip-blobs-bigger-than 10M

# Clean up and push
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push origin --force --all
```

## Required Files for Development

Some files were removed to reduce repository size. Here's how to obtain them:

### 1. Whisper ML Model (75MB)

Required for Swift SDK speech-to-text:

```bash
cd sdks/swift/Sources/omi-lib/Resources/
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

Or use the script in the Resources directory README.

### 2. Demo Videos

Video files in `plugins/hume-ai/video/` and `docs/images/` are available:
- From GitHub Releases (if published)
- By contacting maintainers
- Or create your own following the plugin setup instructions

### 3. CAD Files

Hardware design files are available:
- From the project's hardware documentation
- Contact maintainers for original files
- Use the simpler versions available in the repository

## Monitoring Repository Size

Check your repository size:

```bash
# Total repository size
du -sh .

# Git directory size (history)
du -sh .git

# Largest files in git history
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print substr($0,6)}' | \
  sort -k2 -n -r | head -20
```

## Continuous Integration

To prevent large files from being committed in the future:

1. Add a pre-commit hook to check file sizes
2. Use GitHub Actions to validate PR file sizes
3. Document file size limits in CONTRIBUTING.md

Example pre-commit hook:

```bash
#!/bin/bash
# .git/hooks/pre-commit

MAX_SIZE=10485760 # 10MB in bytes

# Check for large files
large_files=$(git diff --cached --name-only | while read file; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ "$size" -gt "$MAX_SIZE" ]; then
            echo "$file ($size bytes)"
        fi
    fi
done)

if [ -n "$large_files" ]; then
    echo "Error: The following files are larger than 10MB:"
    echo "$large_files"
    echo "Please use Git LFS or external hosting for large files."
    exit 1
fi
```

## Alternative: Git LFS

For projects that need to version large files, consider using Git LFS (Large File Storage):

```bash
# Install Git LFS
git lfs install

# Track large file types
git lfs track "*.mov"
git lfs track "*.bin"
git lfs track "*.f3z"

# Commit .gitattributes
git add .gitattributes
git commit -m "Configure Git LFS"
```

## Summary

- ✅ Large binary files excluded from future commits via `.gitignore`
- ✅ ~331MB of files removed from current working tree
- ✅ Documentation added for obtaining required files
- ⚠️ Git history still contains old large files (~400MB)
- 💡 Use shallow clone (`--depth 1`) for deployments to save space
- 🔧 Contact repository admins for history rewrite if needed

For questions or issues, open an issue on GitHub.
