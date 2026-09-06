# CLAUDE.md

GNOME Shell 50（Ubuntu 26.04、Wayland）向けの拡張機能。「ワークベンチ」（一括起動するアプリの組と配置）を定義し、選ぶとアプリを起動して指定したワークスペース・モニター・位置へ並べる。GNOME 本体の「ワークスペース」（仮想デスクトップ）とは別概念。

## ファイル構成

- `extension.js` — 実行される本体（依存なしの素のJS）。`src/extension.ts` と `types/ambient.d.ts` はTypeScript移植用の雛形で、ビルドには使っていない。
- `metadata.json` — UUID は `workbench-launcher@tryandhappy`（名前空間は個人名。フォーク時のみ変更）、対応 shell-version は `50` のみ。
- `workbenches.example.json` — サンプル設定。初回 `install.sh` 時に `~/.config/workbench-launcher/workbenches.json` へコピーされる（既存があれば上書きしない）。
- `bin/workbench-launcher` — CLI。拡張の D-Bus インターフェースを `gdbus call` で呼ぶ薄いラッパー。`install.sh` が `~/.local/bin/` へ配置する。`launch <id> --wait N` は拡張が有効になるまで再試行する（autostart 用）。
- `create-shortcut.sh` — `.desktop` ファイル生成。配置先は desktop / applications / autostart の3種。Exec は上記 CLI を呼ぶ。
- `install.sh` / `uninstall.sh` — `~/.local/share/gnome-shell/extensions/<UUID>/` と `~/.local/bin/workbench-launcher` の配置と撤去。
- `Makefile` — `make check`（構文チェック）、`make install`、`make package`（zip作成）。

## 動作の要点

- `enable()` はパネルアイコンの追加と `window-created` の監視開始、設定の読み込みだけを行う。アプリは起動しない。
- アプリの起動はパネルメニュー、または D-Bus の `LaunchWorkbench(id)` から `_launchWorkbench` を呼んだとき。ショートカット・自動起動・CLI・キーボードショートカットはすべて D-Bus 経由。
- D-Bus は `org.gnome.Shell` 宛て、パス `/org/gnome/Shell/Extensions/WorkbenchLauncher`、インターフェース `org.gnome.Shell.Extensions.WorkbenchLauncher`。メソッドは `LaunchWorkbench(s)` / `ListWorkbenches() -> as` / `Reload()`。`enable()` で export、`disable()` で unexport する。
- 起動後は `window-created` で新規ウィンドウを appId / wmClass / titleContains で照合し、`Meta.Window` で配置。アプリ側の初期サイズ上書きに備えて 350ms / 1000ms 後に再適用する。
- `reuseExisting: true` のアプリは、既に一致するウィンドウがあれば再起動せず再配置する。

## インストールと有効化の注意

- GNOME Shell は拡張ディレクトリをログイン時にのみ走査する。`install.sh` 直後に `gnome-extensions enable` を実行すると「拡張機能は存在しません」になるのが正常で、ログアウト・再ログイン後に実行する。Wayland では Shell の再起動はできない。
- サンプル設定の SSH 接続先 `sample-web` / `sample-app` / `sample-db` は `~/.ssh/config` への登録が前提。実際に使うには接続先を登録するか設定を書き換える。

## 開発時の注意

- コードを変更したら `make check` を通し、`./install.sh` で再配置する。Wayland では拡張の再読み込みにも再ログインが必要。
- UUID を変更した場合は、旧 UUID のディレクトリが `~/.local/share/gnome-shell/extensions/` に残るので手で撤去する。
- Shell 側のログは `journalctl --user -b --no-pager | grep -i 'Workbench Launcher'` で確認する。
- 設定の変更だけならパネルメニューの「設定を再読み込み」で反映できる。
- 新しいファイルを追加したら `Makefile` の `check`（bash -n）と `package`（zip 対象）に加える。
- 個人の環境に依存する値（ドメイン、ホスト名、URL、アプリID）はリポジトリに入れず、`example` 系のプレースホルダを使う。
