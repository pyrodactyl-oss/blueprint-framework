#!/usr/bin/env bash
# easy-sync.sh — Keep fork in sync the easy way (no overwrites).
# - Keeps 'main' equal to upstream/main
# - Generates a text file listing files changed upstream since last sync (no dev diffs)
# - Merges updated 'main' into your 'dev' branch
# Usage:
#   ./easy-sync.sh init  UPSTREAM_URL=https://github.com/original/blueprintFramework.git
#   ./easy-sync.sh sync
# Optional env:
#   MAIN=main DEV=dev UPSTREAM=upstream NON_INTERACTIVE=1

set -euo pipefail

MAIN="${MAIN:-main}"
DEV="${DEV:-dev}"
UPSTREAM="${UPSTREAM:-upstream}"
NON_INTERACTIVE="${NON_INTERACTIVE:-0}"
SYNC_TAG="upstream_sync_point"  # we move this tag forward each successful sync

say(){ printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[✗]\033[0m %s\n" "$*" >&2; exit 1; }

need_clean() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    err "Your working tree has changes. Commit or stash before running."
  fi
}

confirm() {
  if [[ "$NON_INTERACTIVE" == "1" ]]; then return 0; fi
  read -r -p "$1 [y/N] " a; [[ "${a,,}" == "y" || "${a,,}" == "yes" ]]
}

ensure_branch() {
  git show-ref --verify --quiet "refs/heads/$1" || err "Branch '$1' doesn't exist."
}

ensure_upstream() {
  if ! git remote get-url "$UPSTREAM" >/dev/null 2>&1; then
    [[ "${UPSTREAM_URL:-}" ]] || err "No '$UPSTREAM' remote. Set UPSTREAM_URL=... and run init."
    say "Adding remote '$UPSTREAM' → $UPSTREAM_URL"
    git remote add "$UPSTREAM" "$UPSTREAM_URL"
  fi
}

backup_tags() {
  local d; d="$(date +%F)"
  git tag -f "backup/${MAIN}-${d}" "$MAIN" 2>/dev/null || true
  git tag -f "backup/${DEV}-${d}"  "$DEV"  2>/dev/null || true
}

write_changes_file() {
  local old="$1" new="$2" out="UPSTREAM_CHANGES_${new:0:7}.txt"
  say "Writing upstream change list → $out"
  {
    echo "# Upstream changes (files) ${old:0:7}..${new:0:7}"
    echo "# Generated: $(date -Iseconds)"
    echo
    echo "## Files changed (name-status):"
    git diff --name-status "$old" "$new"
    echo
    echo "## Commits included:"
    git log --oneline --no-decorate "$old..$new"
  } > "$out"
  say "Created $out"
}

do_init() {
  ensure_upstream
  say "Fetching remotes…"
  git fetch --all --prune
  ensure_branch "$MAIN" || true
  ensure_branch "$DEV"  || true

  say "Enabling Git conflict memory (rerere)…"
  git config --global rerere.enabled true

  backup_tags

  # Seed the sync tag to current upstream/main (or current main if upstream missing)
  local seed
  if git rev-parse --verify "$UPSTREAM/$MAIN" >/dev/null 2>&1; then
    seed="$(git rev-parse "$UPSTREAM/$MAIN")"
  else
    seed="$(git rev-parse "$MAIN")"
    warn "Upstream branch not found; seeding sync point from local '$MAIN'."
  fi

  git tag -f "$SYNC_TAG" "$seed"
  say "Init complete. Next time, just run: ./easy-sync.sh sync"
}

do_sync() {
  need_clean
  ensure_upstream
  ensure_branch "$MAIN"
  ensure_branch "$DEV"

  say "Fetching upstream…"
  git fetch "$UPSTREAM" --prune

  local old new
  if git rev-parse -q --verify "$SYNC_TAG" >/dev/null; then
    old="$(git rev-parse "$SYNC_TAG")"
  else
    old="$(git rev-parse "$MAIN")"
    warn "No previous sync point; using current '$MAIN' as baseline."
  fi

  if ! git rev-parse -q --verify "$UPSTREAM/$MAIN" >/dev/null; then
    err "Upstream branch '$UPSTREAM/$MAIN' not found."
  fi
  new="$(git rev-parse "$UPSTREAM/$MAIN")"

  if [[ "$old" == "$new" ]]; then
    say "Upstream is unchanged since last sync. Nothing to do."
    exit 0
  fi

  # 1) Update local main to upstream/main (mirror)
  say "Updating '$MAIN' to match '$UPSTREAM/$MAIN'…"
  git checkout "$MAIN"
  # Try fast-forward; if diverged, hard reset because main is our mirror of upstream.
  if ! git merge --ff-only "$UPSTREAM/$MAIN"; then
    warn "'$MAIN' diverged; resetting to upstream (this is OK for a mirror)."
    git reset --hard "$UPSTREAM/$MAIN"
  fi
  # Optional: push your mirror if you have a GitHub 'origin'
  if git remote get-url origin >/dev/null 2>&1; then
    say "Pushing mirrored '$MAIN' to origin…"
    git push origin "$MAIN" --force-with-lease || true
  fi

  # 2) Produce a text file listing upstream-only changes (no dev diffs)
  write_changes_file "$old" "$new"

  # 3) Merge updated main → dev (this brings in upstream updates without overwriting your edits)
  say "Merging '$MAIN' → '$DEV'…"
  git checkout "$DEV"
  set +e
  git merge "$MAIN"
  merge_rc=$?
  set -e

  if [[ $merge_rc -ne 0 ]]; then
    warn "Merge has conflicts. Resolve them in your editor, then run:"
    echo "    git add <resolved files>"
    echo "    git commit   # completes the merge"
    echo "    git push"
    # auto-open VS Code if available
    if command -v code >/dev/null 2>&1; then
      say "Opening conflicts in VS Code…"
      code .
    fi
    # move sync tag anyway — upstream was consumed into main; changes file already written
    git tag -f "$SYNC_TAG" "$new"
    exit 1
  fi

  # 4) Push dev
  if git remote get-url origin >/dev/null 2>&1; then
    say "Pushing '$DEV'…"
    git push origin "$DEV" || true
  fi

  # 5) Move the sync tag forward
  git tag -f "$SYNC_TAG" "$new"
  say "Sync complete. Upstream changes were captured in a text file and merged into '$DEV'."
}

cmd="${1:-}"
case "$cmd" in
  init) do_init ;;
  sync) do_sync ;;
  *) echo "Usage: $0 init|sync"; exit 1 ;;
esac
