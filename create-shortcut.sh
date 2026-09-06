#!/usr/bin/env bash
# ワークベンチを起動する .desktop ファイル（ショートカット）を作成する。
#
#   ./create-shortcut.sh <workbench-id> [desktop|applications|autostart]
#
#   desktop      デスクトップに置く（既定）。ダブルクリックで起動する。
#   applications アプリ一覧（アクティビティ検索）に登録する。
#   autostart    ログイン時に自動起動する。
set -euo pipefail

[[ $# -ge 1 ]] || { sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

workbench_id="$1"
location="${2:-desktop}"
config="${XDG_CONFIG_HOME:-$HOME/.config}/workbench-launcher/workbenches.json"
launcher="$HOME/.local/bin/workbench-launcher"

[[ -x "$launcher" ]] || { printf 'launcher が見つかりません: %s\n./install.sh を先に実行してください。\n' "$launcher" >&2; exit 1; }

workbench_name="$(python3 - "$config" "$workbench_id" <<'PY'
import json, sys
config, workbench_id = sys.argv[1], sys.argv[2]
with open(config, encoding="utf-8") as f:
    workbenches = json.load(f)["workbenches"]
for p in workbenches:
    if p["id"] == workbench_id:
        print(p["name"])
        sys.exit(0)
ids = ", ".join(p["id"] for p in workbenches) or "(なし)"
print(f'ワークベンチ "{workbench_id}" は {config} にありません。利用可能: {ids}', file=sys.stderr)
sys.exit(1)
PY
)"

case "$location" in
    desktop)
        target_dir="$(xdg-user-dir DESKTOP 2>/dev/null || printf '%s/Desktop' "$HOME")"
        exec_line="$launcher launch $workbench_id"
        ;;
    applications)
        target_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
        exec_line="$launcher launch $workbench_id"
        ;;
    autostart)
        target_dir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
        # ログイン直後は拡張機能が有効になる前に実行されるため、最長60秒待つ
        exec_line="$launcher launch $workbench_id --wait 60"
        ;;
    *)
        printf '不明な配置先: %s（desktop / applications / autostart）\n' "$location" >&2
        exit 1
        ;;
esac

install -d "$target_dir"
target="$target_dir/workbench-launcher-$workbench_id.desktop"

cat > "$target" <<DESKTOP
[Desktop Entry]
Type=Application
Name=$workbench_name
Comment=Workbench Launcher: $workbench_id を起動
Exec=$exec_line
Icon=applications-development
Terminal=false
Categories=Utility;
StartupNotify=false
DESKTOP

chmod +x "$target"
# デスクトップ上の .desktop を「信頼済み」にし、初回の「起動を許可」確認を省く
gio set "$target" metadata::trusted true 2>/dev/null || true

if [[ "$location" == "applications" ]]; then
    update-desktop-database "$target_dir" 2>/dev/null || true
fi

printf 'Created: %s\n' "$target"
