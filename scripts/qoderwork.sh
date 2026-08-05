#!/usr/bin/env bash
# qoderwork.sh — cross-platform workspace entrypoint (Windows Git Bash + WSL Ubuntu)
#
# Plan anchor: plans/cross-platform-universality-m1/03-phase-entrypoint-optional.md
# (PHASE-03 / XP-REQ-012, DEC-004 lifted 2026-08-04)
#
# Design contract:
#   * WORK_ONE_ROOT and QODERWORK_ROOT are derived exclusively from
#     resolveWorkspacePaths({ env: process.env }) in scripts/lib/workspace-paths.ts.
#     This script contains NO platform-default workspace path literals.
#   * Supported shells: Windows Git Bash (MSYS/MINGW/Cygwin OSTYPE) and WSL
#     Ubuntu (detected via /proc/version). Unknown platforms fail closed.
#   * ${QW_WSL_DISTRO:-Ubuntu-24.04} is the only literal default in this
#     script; it selects the WSL distro for Windows-side -> WSL delegation.
#   * When the resolver cannot resolve a path, its error and exit code are
#     surfaced verbatim (fail-closed). No default is ever substituted.
#
# Usage:
#   scripts/qoderwork.sh resolve         resolver JSON (proxies workspace-paths.ts)
#   scripts/qoderwork.sh resolve --wsl   (Git Bash only) delegate to the WSL distro
#   scripts/qoderwork.sh path            print WORK_ONE_ROOT / QODERWORK_ROOT lines
#   scripts/qoderwork.sh help            usage text

set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" >/dev/null 2>&1 && pwd -P)" || {
  echo "qoderwork.sh: cannot determine script directory" >&2
  exit 2
}

RESOLVER_FILE="$SCRIPT_DIR/lib/workspace-paths.ts"

# ${QW_WSL_DISTRO:-Ubuntu-24.04} is the only literal default allowed in this
# script (per PHASE-03). It is consumed, never reassigned with a new default.
WSL_DISTRO="${QW_WSL_DISTRO:-Ubuntu-24.04}"

die() {
  echo "qoderwork.sh: $*" >&2
  exit 2
}

usage() {
  cat <<'USAGE'
qoderwork.sh — cross-platform workspace entrypoint (Git Bash + WSL Ubuntu)

Subcommands:
  resolve          Run resolveWorkspacePaths({ env: process.env }) from
                   scripts/lib/workspace-paths.ts and print the resolver JSON.
                   Exits non-zero with the resolver's own error message when
                   resolution fails (fail-closed; no silent defaults).
  resolve --wsl    (Windows Git Bash only) delegate `resolve` into the WSL
                   distro selected by ${QW_WSL_DISTRO:-Ubuntu-24.04}.
  path             Derive and print WORK_ONE_ROOT=, QODERWORK_ROOT= and
                   WORK_ONE_SOURCE= lines (plus BUN_BIN= / CODEGRAPH_BIN=
                   when the resolver reports them).
  help             Show this text.

Environment:
  WORK_ONE_ROOT    Consumed by the resolver (precedence 2). This script only
                   passes the current environment through; it never sets it.
  QW_WSL_DISTRO    WSL distro used by `resolve --wsl` (default Ubuntu-24.04).
USAGE
}

detect_platform() {
  # Git Bash / MSYS2 / MINGW / Cygwin shells self-identify via OSTYPE.
  case "${OSTYPE:-}" in
    msys* | cygwin* | mingw*)
      echo "git-bash"
      return 0
      ;;
  esac
  # WSL kernels advertise themselves in /proc/version.
  if [[ -r /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
    echo "wsl"
    return 0
  fi
  echo "unknown"
}

QODERWORK_PLATFORM="$(detect_platform)"
if [[ "$QODERWORK_PLATFORM" == "unknown" ]]; then
  die "unsupported platform (expected Windows Git Bash or WSL Ubuntu); OSTYPE='${OSTYPE:-}'"
fi

find_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi
  # Documented repository convention: on WSL/Linux hosts bun commonly lives
  # in ${HOME}/.bun/bin and is not on the non-interactive PATH.
  if [[ -n "${HOME:-}" && -x "$HOME/.bun/bin/bun" ]]; then
    echo "$HOME/.bun/bin/bun"
    return 0
  fi
  return 1
}

# JavaScript executed via `bun -e`. It imports the resolver module by file
# URL and calls resolveWorkspacePaths({ env: process.env }). The resolver
# path and output format are provided by this shell script via env vars.
RESOLVER_SNIPPET="$(cat <<'SNIPPET'
const { pathToFileURL } = await import("node:url");
const resolverPath = process.env.QODERWORK_RESOLVER_PATH;
if (!resolverPath) {
  console.error("qoderwork.sh: internal error: QODERWORK_RESOLVER_PATH is not set");
  process.exit(3);
}
const mod = await import(pathToFileURL(resolverPath).href);
const format = process.env.QODERWORK_RESOLVER_FORMAT || "pretty";
let result;
try {
  result = mod.resolveWorkspacePaths({ env: process.env });
} catch (error) {
  const code = error && error.code ? error.code : "RESOLVER_ERROR";
  const message = error && error.message ? error.message : String(error);
  console.error(code + ": " + message);
  process.exit(2);
}
if (format === "env") {
  console.log("QODERWORK_ROOT=" + result.qoderworkRoot);
  console.log("WORK_ONE_ROOT=" + result.workOneRoot);
  console.log("WORK_ONE_SOURCE=" + result.workOneSource);
  if (result.bunBin) console.log("BUN_BIN=" + result.bunBin);
  if (result.codegraphBin) console.log("CODEGRAPH_BIN=" + result.codegraphBin);
} else {
  console.log(JSON.stringify(result, null, 2));
}
SNIPPET
)"

# run_resolver <pretty|env> — invokes the resolver through bun; the bun
# process is the last command, so its exit code propagates unchanged.
run_resolver() {
  local format="$1"
  local bun_bin
  bun_bin="$(find_bun)" || die "bun executable not found; it is required to run $RESOLVER_FILE (install bun or add it to PATH)"
  [[ -f "$RESOLVER_FILE" ]] || die "resolver not found: $RESOLVER_FILE"
  local resolver_path="$RESOLVER_FILE"
  if [[ "$QODERWORK_PLATFORM" == "git-bash" ]] && command -v cygpath >/dev/null 2>&1; then
    # bun is a native Windows binary under Git Bash; hand it a Windows path.
    resolver_path="$(cygpath -w "$resolver_path")"
  fi
  QODERWORK_RESOLVER_PATH="$resolver_path" \
  QODERWORK_RESOLVER_FORMAT="$format" \
    "$bun_bin" -e "$RESOLVER_SNIPPET"
}

delegate_resolve_to_wsl() {
  command -v cygpath >/dev/null 2>&1 || die "resolve --wsl requires cygpath to translate paths (Git Bash)"
  local wsl_bin
  wsl_bin="$(command -v wsl.exe || command -v wsl || true)"
  if [[ -z "$wsl_bin" || ! -x "$wsl_bin" ]]; then
    die "resolve --wsl requires wsl.exe, but it was not found on PATH"
  fi
  local win_script wsl_script
  # cygpath -m emits forward slashes: wsl.exe eats backslashes in CLI
  # arguments, but forward-slash Windows paths pass through unchanged.
  win_script="$(cygpath -m "$SCRIPT_DIR/qoderwork.sh")"
  wsl_script="$(MSYS_NO_PATHCONV=1 "$wsl_bin" -d "$WSL_DISTRO" -- wslpath -u "$win_script")" \
    || die "resolve --wsl: wslpath failed in WSL distro '$WSL_DISTRO' for '$win_script'"
  [[ -n "$wsl_script" ]] || die "resolve --wsl: wslpath returned an empty path"
  # wsl.exe does not inherit arbitrary Windows env vars; WSLENV is the
  # documented forwarding channel for the config the resolver consumes.
  local wslenv="${WSLENV:+$WSLENV:}WORK_ONE_ROOT:QW_WSL_DISTRO"
  # Re-enter this same script inside the WSL distro; exit code propagates.
  # MSYS_NO_PATHCONV keeps MSYS from rewriting the POSIX WSL path argument.
  MSYS_NO_PATHCONV=1 WSLENV="$wslenv" exec "$wsl_bin" -d "$WSL_DISTRO" -- bash "$wsl_script" resolve
}

cmd_resolve() {
  local use_wsl=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --wsl) use_wsl=1 ;;
      *) die "resolve: unknown argument: $1 (only --wsl is supported)" ;;
    esac
    shift
  done
  if [[ "$use_wsl" == 1 ]]; then
    [[ "$QODERWORK_PLATFORM" == "git-bash" ]] \
      || die "resolve --wsl is only available from Windows Git Bash (already inside WSL)"
    delegate_resolve_to_wsl
    return 0
  fi
  run_resolver pretty
}

cmd_path() {
  if [[ $# -gt 0 ]]; then
    die "path: unexpected argument: $1"
  fi
  local out rc
  out="$(run_resolver env)" || {
    rc=$?
    die "resolver failed (exit $rc); refusing to substitute any default path"
  }
  local work_one_root="" qoderwork_root="" work_one_source="" bun_bin="" codegraph_bin=""
  local line
  while IFS= read -r line; do
    case "$line" in
      WORK_ONE_ROOT=*) work_one_root="${line#WORK_ONE_ROOT=}" ;;
      QODERWORK_ROOT=*) qoderwork_root="${line#QODERWORK_ROOT=}" ;;
      WORK_ONE_SOURCE=*) work_one_source="${line#WORK_ONE_SOURCE=}" ;;
      BUN_BIN=*) bun_bin="${line#BUN_BIN=}" ;;
      CODEGRAPH_BIN=*) codegraph_bin="${line#CODEGRAPH_BIN=}" ;;
    esac
  done <<<"$out"
  [[ -n "$work_one_root" ]] || die "resolver output missing WORK_ONE_ROOT; refusing to substitute any default path"
  [[ -n "$qoderwork_root" ]] || die "resolver output missing QODERWORK_ROOT; refusing to substitute any default path"
  [[ -n "$work_one_source" ]] || die "resolver output missing WORK_ONE_SOURCE; refusing to substitute any default path"
  echo "WORK_ONE_ROOT=$work_one_root"
  echo "QODERWORK_ROOT=$qoderwork_root"
  echo "WORK_ONE_SOURCE=$work_one_source"
  if [[ -n "$bun_bin" ]]; then
    echo "BUN_BIN=$bun_bin"
  fi
  if [[ -n "$codegraph_bin" ]]; then
    echo "CODEGRAPH_BIN=$codegraph_bin"
  fi
}

main() {
  local cmd="${1:-}"
  if [[ $# -gt 0 ]]; then
    shift
  fi
  case "$cmd" in
    resolve) cmd_resolve "$@" ;;
    path) cmd_path "$@" ;;
    help | --help | -h) usage ;;
    "")
      usage >&2
      exit 2
      ;;
    *) die "unknown subcommand: $cmd (expected: resolve | path | help)" ;;
  esac
}

main "$@"
