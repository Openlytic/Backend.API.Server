#!/usr/bin/env bash
# PostToolUse(Write|Edit): log structural edits to .claude/changes.md so a new
# Claude session can read what recently changed. Safe by design — categorized
# paths only; .claude/changes.md is git-ignored (per-machine working log).

INPUT=$(cat)

FILE_PATH=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    print(ti.get('file_path', ti.get('path', '')))
except Exception:
    pass
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

# Skip meta/generated files
echo "$FILE_PATH" | grep -qE "(\.claude/|node_modules/|build/|dist/|CLAUDE\.md)" && exit 0

# Categorize by Openlytic path conventions
CATEGORY=""
if echo "$FILE_PATH" | grep -qE "/src/modules/[^/]+/[^/]+\.entity\.ts$"; then
  CATEGORY="[entity]"
elif echo "$FILE_PATH" | grep -qE "/src/modules/[^/]+/[^/]+\.(service|helper)\.ts$"; then
  CATEGORY="[module-logic]"
elif echo "$FILE_PATH" | grep -qE "/src/graphql/typeDefs/.*\.graphql$"; then
  CATEGORY="[graphql-schema]"
elif echo "$FILE_PATH" | grep -qE "/src/graphql/resolvers/.*\.ts$"; then
  CATEGORY="[graphql-resolver]"
elif echo "$FILE_PATH" | grep -qE "/src/graphql/directives/.*\.ts$"; then
  CATEGORY="[graphql-directive]"
elif echo "$FILE_PATH" | grep -qE "/src/utils/.*\.ts$"; then
  CATEGORY="[util]"
elif echo "$FILE_PATH" | grep -qE "/src/routes/.*\.ts$"; then
  CATEGORY="[route]"
elif echo "$FILE_PATH" | grep -qE "(package\.json|tsconfig\.json|src/server\.ts$|src/env\.ts$|src/modules/entities\.ts$|\.env)"; then
  CATEGORY="[config]"
fi

[ -z "$CATEGORY" ] && exit 0

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Resolve project root (two levels up from .claude/hooks/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CHANGES_FILE="$PROJECT_ROOT/.claude/changes.md"

if [ ! -f "$CHANGES_FILE" ]; then
  {
    echo "# Structural Changes Log"
    echo ""
    echo "> Auto-updated by the track-changes hook. Read before starting work in a new conversation."
    echo ""
  } > "$CHANGES_FILE"
fi

REL_PATH="${FILE_PATH#"$PROJECT_ROOT"/}"
echo "- \`$TIMESTAMP\` $CATEGORY \`$REL_PATH\`" >> "$CHANGES_FILE"

# Keep header + last 80 entries to prevent unbounded growth
HEADER=$(head -4 "$CHANGES_FILE")
ENTRIES=$(grep "^- \`" "$CHANGES_FILE" | tail -80)
{ echo "$HEADER"; echo ""; echo "$ENTRIES"; } > "$CHANGES_FILE"

exit 0