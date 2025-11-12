# Instructions for Creating GitHub Fork

## Current Status

All changes have been merged into the `merge-all-changes` branch, which is based on the original repository (artem-barmin/obsidian-block-drag-n-drop) and includes:

1. ✅ h-nari's fixes from `view_taken_from_domEventHander` branch
2. ✅ All enhancements from manssorr's fork

## Steps to Create the New Fork

### 1. Fork the Original Repository

1. Go to https://github.com/artem-barmin/obsidian-block-drag-n-drop
2. Click the "Fork" button in the top right
3. This creates a fork under your GitHub account

### 2. Add Your Fork as a Remote

```bash
# Add your new fork as a remote (replace YOUR_USERNAME with your GitHub username)
git remote add new-fork https://github.com/YOUR_USERNAME/obsidian-block-drag-n-drop.git
```

### 3. Push the Merged Branch

```bash
# Push the merge-all-changes branch to your new fork
git push new-fork merge-all-changes:main

# Or if you want to keep it as a separate branch first
git push new-fork merge-all-changes
```

### 4. Set Default Branch (Optional)

If you want `merge-all-changes` to be the default branch:
1. Go to your fork on GitHub
2. Settings → Branches
3. Change default branch to `merge-all-changes` (or merge it into `main`)

### 5. Update README Repository Links

After pushing, update any repository links in the README to point to your new fork.

## Verification

After pushing, verify:
- ✅ All files are present
- ✅ Plugin builds successfully (`npm run build`)
- ✅ README includes proper credits
- ✅ All features from both sources are included

## Current Branch Structure

```
upstream/master (original)
  └── h-nari/view_taken_from_domEventHander (merged)
      └── merge-all-changes (includes all enhancements)
```

## Files Changed

The merge includes changes to:
- `main.ts` - Core plugin logic with all enhancements
- `README.md` - Updated with credits and changelog
- `package.json` - Updated dependencies
- `styles.css` - UI enhancements
- `package-lock.json` - Dependency lock file

