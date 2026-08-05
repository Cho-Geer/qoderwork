#!/usr/bin/env bash
#
# framework-inventory.sh — Phase 0 evidence-freeze inventory for the
# work-one framework deprecated-content audit.
#
# Prints a snapshot of the *active* runtime surface so future cleanup
# commits can be diffed against it. Does NOT modify anything.
#
# Usage:
#   framework-inventory.sh [WORKONE_DIR]
#   framework-inventory.sh ${WORK_ONE_ROOT}
#
set -euo pipefail

WORKONE="${1:-${WORK_ONE_ROOT}}"
cd "$WORKONE"

echo "============================================================"
echo "work-one Framework Inventory  ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo "Target: $WORKONE"
echo "============================================================"

echo
echo "## 1. Active Agents + Models (opencode.json)"
jq -r '.agent | to_entries[] | "  \(.key)\tmodel=\(.value.model)\tnative=\(.value.native // false)"' opencode.json

echo
echo "## 2. Plugin Entrypoints (opencode.json)"
jq -r '.plugin[]' opencode.json | sed 's#.*/#.opencode/plugins/#' | sed 's#^#  #'

echo
echo "## 3. Active Handler Order (project.config.json plugin_execution_order)"
for phase in before after system; do
  n=$(jq -r ".plugin_execution_order.$phase | length" .opencode/project.config.json 2>/dev/null || echo "?")
  handlers=$(jq -r ".plugin_execution_order.$phase | join(\" > \")" .opencode/project.config.json 2>/dev/null || echo "?")
  echo "  [$phase] count=$n"
  echo "    $handlers"
done

echo
echo "## 4. Deprecated-symbol reachability grep (active runtime / prompt paths)"
echo "  -- Scout / scout (expect ONLY retirement guard in agent-target.ts + historical archive) --"
rg -n "Scout|scout" --glob '!.trash*' --glob '!blueprints' --glob '!node_modules' \
   AGENTS.md .opencode/agents .opencode/legacy .opencode/skills .opencode/service .opencode/plugins .opencode/plugin-handlers \
   2>/dev/null || echo "    (none found in active paths)"

echo
echo "  -- Enforcement-mode compat shims --"
rg -n "getEnforcementMode\b|getEnforcementModeWithSource|getEnforcementModeCompat" \
   .opencode/service .opencode/hooks .opencode/scripts 2>/dev/null || echo "    (none)"

echo
echo "  -- Deprecated DAG / dispatch_context helpers --"
rg -n "checkDagExists|checkTaskInDag|checkDagProgress|dbInsertDispatchContext" \
   .opencode/service .opencode/lib 2>/dev/null || echo "    (none)"

echo
echo "  -- isWriteAllowed (deprecated write-audit caller) --"
rg -n "isWriteAllowed" .opencode/service 2>/dev/null || echo "    (none)"

echo
echo "  -- LEGACY HANDLER labels (vs DELEGATE HANDLER) --"
rg -n "LEGACY HANDLER|DELEGATE HANDLER" .opencode/plugin-handlers 2>/dev/null || echo "    (none)"

echo
echo "  -- Old DAG / pre-execution script references --"
rg -n "pre-execution-gate|pre-execution-hook|@Meta-Planner|Task\.DAG" \
   AGENTS.md .opencode 2>/dev/null | rg -v "blueprints" || echo "    (none)"

echo
echo "============================================================"
echo "Inventory complete. Diff this output across cleanup commits."
echo "============================================================"
