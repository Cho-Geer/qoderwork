#!/usr/bin/env bash
set -u
cd ${WORK_ONE_ROOT} || exit 1

echo "===== .trash-db contents ====="
ls -laR .opencode/.trash-db 2>/dev/null | head -30
echo "===== src/_e2e_test_fixture ====="
ls -laR src 2>/dev/null | head -30
echo "===== grep e2e_test_fixture in source ====="
grep -rn --exclude-dir=node_modules --exclude-dir=.task_temp --exclude-dir=booking_system_refactor --exclude-dir=.git --exclude-dir=docs --include='*.ts' --include='*.json' --include='*.md' --include='*.sh' -e 'e2e_test_fixture' -e '_e2e_test_fixture' . 2>/dev/null | grep -v audit_ | head
echo "===== .gitignore hits for candidates ====="
for t in .trash .task_temp node_modules .agents .codex screenshots _test_scan_fixtures prototype reasonix .opencode/.opencode generated; do
  echo "--- $t ---"
  grep -n "$t" .gitignore 2>/dev/null
done
echo "===== git tracked? (are these folders in git) ====="
git ls-files | grep -E '(\.trash|/\.agents|/\.codex|screenshots|_test_scan_fixtures|prototype|reasonix|\.opencode/\.opencode|/\.task_temp$)' | head -40
echo "===== legacysubagent-preamble refs ====="
grep -rn --exclude-dir=node_modules --exclude-dir=.git --include='*.ts' --include='*.json' --include='*.md' -e 'subagent-preamble' . 2>/dev/null | grep -v audit_ | head
