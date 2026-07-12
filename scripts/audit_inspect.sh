#!/usr/bin/env bash
set -u
cd /home/zhaoge/workspace/opencode/work-one || exit 1

echo "===== TOP-LEVEL src ====="
ls -la src 2>/dev/null
echo "===== TOP-LEVEL scripts ====="
ls -la scripts 2>/dev/null
echo "===== TOP-LEVEL plans ====="
ls -la plans 2>/dev/null
echo "===== prototype ====="
ls -laR prototype 2>/dev/null | head -40
echo "===== .reasonix ====="
ls -la .reasonix 2>/dev/null; echo "--- content ---"; cat .reasonix/* 2>/dev/null | head -20
echo "===== screenshots ====="
ls -la screenshots 2>/dev/null
echo "===== _test_scan_fixtures ====="
ls -la _test_scan_fixtures 2>/dev/null
echo "===== .qoder ====="
ls -la .qoder 2>/dev/null; find .qoder -type f | head
echo "===== .opencode/docs ====="
ls -la .opencode/docs 2>/dev/null
echo "===== .opencode/_test_framework ====="
ls -laR .opencode/_test_framework 2>/dev/null
echo "===== .opencode/.opencode ====="
ls -laR .opencode/.opencode 2>/dev/null | head -40
echo "===== .opencode/generated ====="
ls -la .opencode/generated 2>/dev/null
echo "===== .opencode/legacy ====="
ls -laR .opencode/legacy 2>/dev/null | head -40
echo "===== .opencode/eslint-plugin ====="
ls -laR .opencode/eslint-plugin 2>/dev/null | head -40
