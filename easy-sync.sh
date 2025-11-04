#!/usr/bin/env bash
# easy-sync.sh — Mirror upstream/main into local 'upstream', then merge into your 'main'.
# Usage:
#   UPSTREAM_URL=https://github.com/<original-owner>/blueprintFramework.git ./easy-sync.sh init
#   ./easy-sync.sh sync
# Env (override if you like):
#   MIRROR=upstream     # local branch that mirrors upstream/main
#   WORK=main           # your working branch
#   REMOTE_UP=upstream  # remote pointing at the original repo
#   NON_INTERACTIVE=1   # skip confirmations

set -euo pipefail

MIRROR="${MIRROR:-upstream}"
WORK="${WORK:-main}"
REMOTE_UP="${REMOTE_UP:-upstream}"
NON_INTERACTIVE="${NON_INTERACTIVE:-0}"

say(){ printf "\033[1;34m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
err(){ printf "\033[1;31m[✗]\033[0m %s\n" "$*" >&2; exit 1; }

need_clean(){ if ! git diff --quiet || ! git diff --cached --quiet; then err "Commit or stash your changes first."; fi; }
ensure_branch(){ git show-ref --verify --quiet "refs/heads/$1" || err "Missing branch '$1'."; }
ensure_remote_up(){
  if ! git remote get-url "$REMOTE_UP" >/dev/null 2>&1; then
    [[ "${UPSTREAM_URL:-}" ]] || err "Remote '$REMOTE_UP' not found. Set UPSTREAM_URL=... and run init."
    say "Adding remote '$REMOTE_UP' → $UPSTREAM_URL"
    git remote add "$REMOTE_UP" "$UPSTREAM_URL"
  fi
}

do_init(){
  ensure_remote_up
  git fetch --all --prune
  git config --global rerere.enabled true

  # Create/refresh the mirror branch from upstream/main
  if git rev-parse --verify "$REMOTE_UP/main" >/dev/null 2>&1; then
    if git show-ref --verify --quiet "refs/heads/$MIRROR"; then
      say "Resetting '$MIRROR' to '$REMOTE_UP/main'"
      git checkout "$MIRROR"
      git reset --hard "$REMOTE_UP/main"
    else
      say "Creating local mirror branch '$MIRROR' from $REMOTE_UP/main"
      git checkout -b "$MIRROR" "$REMOTE_UP/main"
    fi
  else
    err "Cannot find $REMOTE_UP/main — check UPSTREAM_URL or permissions."
  fi

  ensure_branch "$WORK"
  say "Init complete. Next time, just run: ./easy-sync.sh sync"
}

do_sync(){
  need_clean
  ensure_remote_up
  ensure_branch "$MIRROR"
  ensure_branch "$WORK"

  say "Fetching upstream…"
  git fetch "$REMOTE_UP" --prune

  say "Updating mirror '$MIRROR' to match '$REMOTE_UP/main'…"
  git checkout "$MIRROR"
  if ! git merge --ff-only "$REMOTE_UP/main"; then
    warn "'$MIRROR' diverged; resetting hard to upstream/main (mirror stays pristine)."
    git reset --hard "$REMOTE_UP/main"
  fi
  # Optionally push mirror to your origin if you keep it on GitHub:
  if git remote get-url origin >/dev/null 2>&1; then
    git push origin "$MIRROR" --force-with-lease || true
  fi

  say "Merging '$MIRROR' → '$WORK'…"
  git checkout "$WORK"
  set +e
  git merge "$MIRROR"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    warn "Merge conflicts detected. Resolve them in your editor:"
    echo "  git add <resolved files>"
    echo "  git commit"
    echo "  git push"
    exit 1
  fi

  if git remote get-url origin >/dev/null 2>&1; then
    say "Pushing '$WORK'…"
    git push origin "$WORK" || true
  fi

  say "Sync complete."
}

case "${1:-}" in
  init) do_init ;;
  sync) do_sync ;;
  *) echo "Usage: $0 init|sync"; exit 1 ;;
esac
