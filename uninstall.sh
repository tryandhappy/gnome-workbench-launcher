#!/usr/bin/env bash
set -euo pipefail

uuid='workbench-launcher@tryandhappy'
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"

gnome-extensions disable "$uuid" 2>/dev/null || true

if [[ -d "$extension_dir" ]]; then
    target_parent="${XDG_DATA_HOME:-$HOME/.local/share}/Trash/files"
    install -d "$target_parent"
    target="$target_parent/$uuid"
    if [[ -e "$target" ]]; then
        target="$target.$(date +%Y%m%d-%H%M%S)"
    fi
    mv "$extension_dir" "$target"
    printf 'Moved extension to Trash: %s\n' "$target"
fi

launcher="$HOME/.local/bin/workbench-launcher"
if [[ -f "$launcher" ]]; then
    rm -f "$launcher"
    printf 'Removed launcher: %s\n' "$launcher"
fi

printf 'Configuration was kept at: %s\n' \
    "${XDG_CONFIG_HOME:-$HOME/.config}/workbench-launcher/workbenches.json"
