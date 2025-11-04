#!/usr/bin/env bash
set -euo pipefail

out=${1:?Usage: ./zip.sh out.zip}

ex=()

# Read .gitignore safely, handle blank/space-only lines
while IFS= read -r line || [[ -n "$line" ]]; do
  # Trim leading/trailing whitespace
  pat="${line#"${line%%[![:space:]]*}"}"    # ltrim
  pat="${pat%"${pat##*[![:space:]]}"}"      # rtrim

  # Skip empty or comment lines
  [[ -z "$pat" || "${pat:0:1}" == "#" ]] && continue

  # Ignore git-negation rules (!pattern) since zip doesn't support them
  [[ "${pat:0:1}" == "!" ]] && continue

  # Drop leading slash (zip patterns are relative)
  [[ "${pat:0:1}" == "/" ]] && pat="${pat:1}"

  # Convert directory ignores like "dir/" to "dir/*"
  [[ "$pat" == */ ]] && pat="${pat}*"

  # Quote each pattern as a separate -x arg
  ex+=(-x "$pat")
done < .gitignore

# Add your explicit excludes
ex+=(-x ".github/*" -x ".git/*" -x ".DS_Store" -x ".zed/*" -x "easy-sync.sh" -x "zip.sh")

# Create the zip
zip -r "$out" . "${ex[@]}"
