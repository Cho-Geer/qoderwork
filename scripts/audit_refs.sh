#!/usr/bin/env bash
set -u
cd ${WORK_ONE_ROOT} || exit 1

# Source tree to scan: framework code + top-level config, excluding deps, runtime, business repo, docs prose, lockfiles
GREP="grep -rn --exclude-dir=node_modules --exclude-dir=.task_temp --exclude-dir=booking_system_refactor --exclude-dir=.git --exclude-dir=docs --exclude-dir=.opencode/node_modules --exclude-dir=.opencode/state --exclude-dir=dist --exclude=*.lock --exclude=package-lock.json --exclude=bun.lock --exclude=Task.DAG.json --exclude=Task.DAG.index.json --exclude=contract.yaml --include='*.ts' --include='*.json' --include='*.md' --include='*.sh' --include='*.yaml' --include='*.yml'"

TOKENS="
.opencode/legacy
_test_framework
.opencode/generated
eslint-plugin
.opencode/context
.opencode/docs
.opencode/config
project.config.json
.opencode/commands
.opencode/service
.opencode/hooks
.opencode/.opencode
.opencode/.task_temp
.trash
prototype
blueprints
screenshots
.agents
.codex
reasonix
.qoder
_test_scan_fixtures
Task.DAG.versions
.opencode/node_modules
"

for t in $TOKENS; do
  # shellcheck disable=SC2086
  hits=$($GREP -e "$t" . 2>/dev/null | grep -v "audit_refs.sh" | head -4)
  n=$(echo "$hits" | grep -c . )
  if [ "$n" -eq 0 ]; then
    printf '%-26s => 0 refs\n' "$t"
  else
    printf '%-26s => %s refs\n' "$t" "$n"
    echo "$hits" | sed 's/^/      /'
  fi
done
