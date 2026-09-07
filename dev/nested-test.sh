#!/usr/bin/env bash
# 開発用: 入れ子の GNOME Shell（gnome-shell --devkit）で作業ツリーの拡張を読み込み、
# ワークベンチを起動してウィンドウの配置結果を JSON で表示する。
# Wayland で再ログインせずに extension.js の変更を確かめるためのもの。
#
#   dev/nested-test.sh <workbenches.json> <workbench-id> [観察秒数(既定 8)]
#
# 実セッションには触れない:
#   - GSETTINGS_BACKEND=memory  … 設定はプロセス内だけ。実 dconf へは一切書かない
#   - XDG_CONFIG_HOME / XDG_DATA_HOME … 一時ディレクトリ。拡張は作業ツリーへのシンボリックリンクで読む
#   - 独立したセッションバス（dbus-run-session）
# 環境変数を dbus-run-session の外で設定すると dconf-service 等が実セッションの設定を
# 書き換えるので、必ず内側（--inner）で設定する。
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)

if [[ "${1:-}" != "--inner" ]]; then
    config=${1:?usage: $0 <workbenches.json> <workbench-id> [wait-seconds]}
    workbench=${2:?usage: $0 <workbenches.json> <workbench-id> [wait-seconds]}
    wait_seconds=${3:-8}
    uuid=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["uuid"])' "$repo/metadata.json")
    inspect_uuid=inspect@workbench-launcher.dev

    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    mkdir -p "$tmp/config/workbench-launcher" "$tmp/data/gnome-shell/extensions"
    cp "$config" "$tmp/config/workbench-launcher/workbenches.json"
    ln -s "$repo" "$tmp/data/gnome-shell/extensions/$uuid"
    ln -s "$repo/dev/$inspect_uuid" "$tmp/data/gnome-shell/extensions/$inspect_uuid"

    export NESTED_TMP=$tmp NESTED_UUID=$uuid NESTED_INSPECT=$inspect_uuid \
           NESTED_WORKBENCH=$workbench NESTED_WAIT=$wait_seconds NESTED_REPO=$repo
    dbus-run-session -- "$0" --inner 2>&1 | grep -v -E 'dbus-daemon\[|SpiRegistry|GNOME_KEYRING_CONTROL'
    exit "${PIPESTATUS[0]}"
fi

# ---- ここから入れ子セッションの内側 ----
export XDG_CONFIG_HOME="$NESTED_TMP/config" XDG_DATA_HOME="$NESTED_TMP/data" GSETTINGS_BACKEND=memory
shell_log="$NESTED_TMP/shell.log"

gnome-shell --devkit --wayland --virtual-monitor "${NESTED_MONITOR:-1600x900}" >"$shell_log" 2>&1 &
shell_pid=$!
cleanup() { kill "$shell_pid" 2>/dev/null; wait "$shell_pid" 2>/dev/null || true; }
trap cleanup EXIT

shell_call() {
    gdbus call --session --dest org.gnome.Shell --object-path "$1" --method "$2" "${@:3}"
}

for _ in $(seq 1 30); do
    shell_call /org/gnome/Shell org.freedesktop.DBus.Peer.Ping >/dev/null 2>&1 && break
    sleep 1
done
if ! shell_call /org/gnome/Shell org.freedesktop.DBus.Peer.Ping >/dev/null 2>&1; then
    echo "入れ子の GNOME Shell が起動しませんでした:" >&2
    cat "$shell_log" >&2
    exit 1
fi
sleep 2

gnome-extensions enable "$NESTED_INSPECT"
gnome-extensions enable "$NESTED_UUID"
sleep 2
echo "== extensions"
gnome-extensions list --enabled

echo "== launch $NESTED_WORKBENCH"
"$NESTED_REPO/bin/workbench-launcher" launch "$NESTED_WORKBENCH" --wait 20
sleep "$NESTED_WAIT"

echo "== result"
shell_call /dev/workbenchLauncher/Inspect dev.workbenchLauncher.Inspect.Dump \
    | python3 -c 'import ast, sys; print(ast.literal_eval(sys.stdin.read().strip())[0])'

echo "== shell log (Workbench Launcher / JS ERROR)"
grep -i -E 'workbench launcher|JS ERROR' "$shell_log" || echo "(なし)"
