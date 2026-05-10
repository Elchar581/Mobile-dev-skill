# Publishing APK to GitHub Releases

Goal: ship a versioned release on GitHub with the `.apk` attached, no `gh` CLI required (curl + REST API).

## Prerequisite: fine-grained PAT scopes

GitHub fine-grained PATs have separate scopes per repo. For push + release, you need:

| Scope | Required for |
|---|---|
| **Contents: Read and write** | `git push`, `git tag`, `POST /releases`, asset upload |
| Metadata: Read | (auto) |
| Workflows: Read and write | only if pushing `.github/workflows/*.yml` |

Wrong scopes manifest as **`HTTP 403 Resource not accessible by personal access token`** on every write op. Don't debug — regenerate.

Generate at: https://github.com/settings/personal-access-tokens
- Repository access: "Only select repositories" → pick the target repo
- Repository permissions: Contents → Read and write

## Full publish flow

```bash
export GH_TOKEN="<fine-grained-pat>"
OWNER="<github-username>"
REPO="<repo-name>"
TAG="v1.0.0"

# 1. Configure git author identity (commits will use these)
git config user.name "<your-name>"
git config user.email "<email>@users.noreply.github.com"  # or real email

# 2. Add remote with token in URL (push only — strip after)
git remote add origin "https://${GH_TOKEN}@github.com/${OWNER}/${REPO}.git"
git push -u origin main

# Strip token immediately after first push
git remote set-url origin "https://github.com/${OWNER}/${REPO}.git"
# Now push works only if token is provided per-push (or via credential helper)

# 3. Create + push annotated tag
git tag -a "$TAG" -m "Release notes summary..."
# For tag push, re-add token URL temporarily
git remote set-url origin "https://${GH_TOKEN}@github.com/${OWNER}/${REPO}.git"
git push origin "$TAG"
git remote set-url origin "https://github.com/${OWNER}/${REPO}.git"

# 4. Create GitHub Release via REST API
RELEASE_BODY='Multi-line\nrelease notes\nin markdown.'
RESP=$(curl -s -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${OWNER}/${REPO}/releases" \
  -d "{
    \"tag_name\": \"$TAG\",
    \"name\": \"$TAG\",
    \"body\": \"$RELEASE_BODY\",
    \"draft\": false,
    \"prerelease\": false
  }")
RELEASE_ID=$(echo "$RESP" | grep -oE '"id":[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')

# 5. Upload APK as asset
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @app.apk \
  "https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${RELEASE_ID}/assets?name=app.apk&label=Android%20APK"

# Output includes browser_download_url — that's the public download link
```

## Notes / gotchas

### `body` with multiline markdown

The release body becomes the description shown on the release page. Multiline JSON is fragile to escape inline. Cleaner pattern: write body to a file, use node to JSON-stringify it inline:

```bash
cat > /tmp/body.md <<'EOF'
First public release of MyApp.

## Install
1. Download `.apk`
2. Allow unknown sources
3. Open file → Install
EOF

curl -s -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER}/${REPO}/releases" \
  -d @- <<JSON
{
  "tag_name": "$TAG",
  "name": "$TAG",
  "body": $(cat /tmp/body.md | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8")))'),
  "draft": false,
  "prerelease": false
}
JSON
```

### Asset upload Content-Type

| File | Content-Type |
|---|---|
| `.apk` | `application/vnd.android.package-archive` |
| `.aab` | `application/octet-stream` |
| `.ipa` | `application/octet-stream` |
| `.tar.gz` | `application/gzip` |

### Token hygiene

- Token in `git remote add origin "https://TOKEN@github.com/..."` is saved in `.git/config`. Strip via `git remote set-url` once you're done.
- Don't grep transcripts for tokens to "verify they're not there" — that just adds them to `.bash_history`.
- Rotate the token after sharing it in a chat / log / CI.

### Rebase before push if remote diverged

If someone (or you in browser) edited files on GitHub:
```bash
git pull --rebase origin main
# resolve any conflicts (most edits are clean), then
git push origin main
```

### Release on existing tag

If you already pushed the tag, `POST /releases` with that `tag_name` works — just creates the release on the existing tag. Don't re-tag.

### Re-uploading an asset (after rebuild)

You can't replace an asset directly; delete + reupload:

```bash
ASSET_ID=$(curl -s -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/${OWNER}/${REPO}/releases/${RELEASE_ID}/assets" \
  | grep -oE '"id":[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')

curl -X DELETE \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${ASSET_ID}"

# then re-upload via uploads.github.com
```

### License + README must be present

GitHub auto-detects license file (`LICENSE` in repo root) and shows the badge. Use SPDX-standard text (e.g. MIT). Adding `"license": "MIT"` to `package.json` also helps tooling.
