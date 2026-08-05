#!/usr/bin/env bash
set -u
cd ${WORK_ONE_ROOT} || exit 1

DIRS="
.opencode/legacy
.opencode/_test_framework
.opencode/generated
.opencode/eslint-plugin
.opencode/context
.opencode/docs
.opencode/config
.opencode/commands
.opencode/service
.opencode/hooks
.opencode/state
.opencode/node_modules
.opencode/.opencode
.opencode/.task_temp
.opencode/.trash-a6-20260629
.opencode/.trash-b4d-20260629
.opencode/.trash-db
.opencode/.trash-phase0
.opencode/.trash-phase1
.opencode/.trash-phase3
src
prototype
blueprints
scripts
plans
docs
screenshots
.agents
.codex
.reasonix
.qoder
_test_scan_fixtures
.github
Task.DAG.versions
"

for d in $DIRS; do
  if [ -d "$d" ]; then
    cnt=$(find "$d" -type f -not -path '*/.git/*' | wc -l)
    sz=$(du -sh "$d" 2>/dev/null | cut -f1)
    recent=$(find "$d" -type f -not -path '*/.git/*' -printf '%TY-%Tm-%Td %TH:%TM\n' 2>/dev/null | sort | tail -1)
    printf '%-32s files=%-5s size=%-8s latest=%s\n' "$d" "$cnt" "$sz" "$recent"
  else
    printf '%-32s [MISSING]\n' "$d"
  fi
done
