#!/usr/bin/env bash
# Privacy gate for a PUBLIC skill repository.
#
# Fails (exit 1) when any tracked file mentions something that belongs to a
# private estate: internal hostnames, machine/tier/team/board sigils, IP
# addresses, or e-mail addresses other than the author's public one. Run it
# before every push; the umbrella repo may hold such text, a public leaf may
# not.
#
# Usage: scripts/check-public.sh [REPO_ROOT]
set -euo pipefail

root=${1:-$(git rev-parse --show-toplevel)}
cd "$root"

# Extend per leaf via .check-public-patterns (one extended regex per line).
patterns=(
  '(^|[^a-z])ifca([^a-z]|$)'
  'geoy\.ws'
  'u-n-u-m\.com'
  '@@[a-z]'         # machine sigil
  '@_[a-z]'         # tier sigil
  '@:[a-z]'         # team sigil
  '@#[a-z]'         # board sigil
  'dev\.azure\.com|visualstudio\.com'
  '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b'
  '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
)
if [[ -f .check-public-patterns ]]; then
  while IFS= read -r line; do
    [[ -z $line || $line == \#* ]] && continue
    patterns+=("$line")
  done < .check-public-patterns
fi

allow_emails='geoyws@gmail\.com|noreply@github\.com'
status=0
while IFS= read -r -d '' file; do
  case "$file" in
    LICENSE|scripts/check-public.sh|.check-public-patterns) continue ;;
  esac
  for p in "${patterns[@]}"; do
    hits=$(grep -nIE -- "$p" "$file" 2>/dev/null | grep -vE -- "$allow_emails" || true)
    if [[ -n $hits ]]; then
      status=1
      printf '%s: matches /%s/\n%s\n' "$file" "$p" "$hits" | sed 's/^/  /'
    fi
  done
done < <(git ls-files -z)

if [[ $status -ne 0 ]]; then
  echo "check-public: private-estate text found; scrub it before pushing a public skill" >&2
fi
exit $status
