#!/usr/bin/env bash
set -euo pipefail

uuid='workbench-launcher@tryandhappy'
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/workbench-launcher"
bin_dir="$HOME/.local/bin"

install -d "$extension_dir" "$config_dir" "$bin_dir"
install -m 0755 "$source_dir/bin/workbench-launcher" "$bin_dir/workbench-launcher"
install -m 0644 "$source_dir/metadata.json" "$extension_dir/metadata.json"
install -m 0644 "$source_dir/extension.js" "$extension_dir/extension.js"

if [[ ! -e "$config_dir/workbenches.json" ]]; then
    install -m 0644 "$source_dir/workbenches.example.json" "$config_dir/workbenches.json"
fi

printf 'Installed: %s\n' "$extension_dir"
printf 'Config:    %s\n' "$config_dir/workbenches.json"
printf 'Launcher:  %s\n' "$bin_dir/workbench-launcher"
printf '\nWaylandでは一度ログアウトして再ログインし、次を実行してください:\n'
printf 'gnome-extensions enable %s\n' "$uuid"
