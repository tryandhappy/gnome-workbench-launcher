# Workbench Launcher for GNOME 50

Ubuntu 26.04標準のGNOME 50＋Mutter＋Wayland上で、作業に必要なアプリの組を一括起動し、指定したワークスペース・モニター・位置へ並べる拡張機能です。ワンクリックで「作業台」を用意する、という意味で Workbench Launcher と名付けています。

この拡張では、まとめて起動するアプリの組と配置を**ワークベンチ**と呼びます。設定ファイルにワークベンチを複数定義し、パネルメニューやショートカットから選んで起動します。GNOME本体の「ワークスペース（仮想デスクトップ）」とは別の概念で、ワークベンチは指定したワークスペースへウィンドウを並べる側です。

## サンプルの動作

トップパネルの開発アイコンから「サンプルワークベンチ」を選択すると、次を起動します。

- Firefox：指定した2つのURL
- Ghostty `sample:web`：`ssh sample-web`
- Ghostty `sample:app`：`ssh sample-app`
- Ghostty `sample:db`：`ssh sample-db`

Firefoxを画面左60%、3つのGhosttyを画面右側へ縦に並べ、仮想ワークスペース2へ移動します。

もう1つの「配置なしサンプル」（ID `sample-plain`）は、`rect`を省略した例です。テキストエディタとファイル（Nautilus）を仮想ワークスペース3へ移動するだけで、ウィンドウの位置とサイズはアプリ任せにします。Nautilusは`width`と`height`を省略して位置だけを指定しています。

サンプル設定は初回の`install.sh`でのみ`~/.config/workbench-launcher/workbenches.json`へコピーされます。既に設定ファイルがある場合は、`workbenches.example.json`から必要な部分を手で写してください。

## インストール

展開したディレクトリで実行します。

```bash
chmod +x install.sh uninstall.sh
./install.sh
```

Waylandでは一度ログアウトして再ログインした後、次を実行します。

```bash
gnome-extensions enable workbench-launcher@tryandhappy
```

GNOME拡張機能の一覧に現れない場合は、次で確認してください。

```bash
gnome-extensions list
journalctl --user -b --no-pager | grep -i 'Workbench Launcher'
```

## 実行のきっかけ

アプリを起動する方法は次のとおりです。いずれも最終的には拡張機能が起動と配置を行います。

- トップパネルの開発アイコンをクリックし、メニューからワークベンチ名を選ぶ
- デスクトップに作ったショートカットをダブルクリックする
- アプリ一覧（アクティビティ検索）から選ぶ
- ログイン時に自動起動する
- コマンドライン、またはキーボードショートカットに登録したコマンドから実行する

メニューの「設定を再読み込み」は`workbenches.json`を再読み込みするだけで、アプリは起動しません。

### ショートカットの作成

`install.sh`は`~/.local/bin/workbench-launcher`にコマンドラインツールも配置します。ショートカットはこのツールを呼び出す`.desktop`ファイルで、次のスクリプトで作成できます。

```bash
./create-shortcut.sh sample               # デスクトップに置く（ダブルクリックで起動）
./create-shortcut.sh sample applications  # アプリ一覧に登録
./create-shortcut.sh sample autostart     # ログイン時に自動起動
```

引数は`workbenches.json`の`id`です。ファイル名は`workbench-launcher-<id>.desktop`になり、表示名には`name`が使われます。不要になったらそのファイルを削除してください。

デスクトップの`.desktop`は信頼済みとして作成するため、通常は「起動を許可」の確認なしにダブルクリックで動きます。確認が出た場合は一度許可すれば以降は出ません。

### コマンドライン

```bash
workbench-launcher list             # 設定済みのワークベンチIDを表示
workbench-launcher launch sample    # ワークベンチを起動
workbench-launcher launch sample --wait 60   # 拡張機能が有効になるまで最長60秒待って起動
workbench-launcher raise sample     # ワークベンチのウィンドウを前面に出す（未起動なら起動）
workbench-launcher raise sample --only   # 前面に出し、同じワークスペースの他のウィンドウは最小化
workbench-launcher cycle            # 起動中のワークベンチを設定の並び順で次へ切り替える
workbench-launcher cycle prev       # 前へ切り替える
workbench-launcher cycle --only     # 切り替え先以外のウィンドウは最小化
workbench-launcher reload           # 設定を再読み込み
```

GNOMEの「設定 → キーボード → カスタムショートカット」で`workbench-launcher launch sample`をコマンドとして登録すると、キーボードから起動できます。`~/.local/bin`が`PATH`に無い環境では、フルパスで指定してください。

### ワークベンチの前面表示と切り替え

起動済みのワークベンチは、ウィンドウの組としてまとめて前面に出したり、組ごとに切り替えたりできます。ウィンドウは各アプリの`match`で見つけるので、この拡張以外から起動したウィンドウも一致すれば対象になります。

- `raise <id>`は、そのワークベンチに属するウィンドウをまとめて前面に出します。ウィンドウが複数のワークスペースに散っている場合は最も多いワークスペースを表示します。ウィンドウが1つも無ければ通常の起動と同じ動きをします。設定で先頭のアプリにフォーカスが移ります。
- `cycle`（または`cycle next`）は、今フォーカスしているウィンドウが属するワークベンチの「次」を、`cycle prev`は「前」を前面に出します。対象はウィンドウを持つワークベンチだけで、設定ファイルの並び順で巡回します。起動していないワークベンチを勝手に起動することはありません。
- `--only`を付けると、表示先のワークスペースにある他の通常ウィンドウを最小化して、そのワークベンチのウィンドウだけを見せます。最小化したウィンドウは、別のワークベンチへ`raise`や`cycle`したときに元に戻ります。
- パネルメニューの「前面に出す」からも同じ操作ができます。

`cycle next`と`cycle prev`をカスタムショートカットに割り当てると、キーで作業の組を前後に切り替えられます。GNOMEの「設定 → キーボード → カスタムショートカット」で登録するほか、次のように`gsettings`でも登録できます（例はCtrl+Shift+右/左）。

```bash
base=org.gnome.settings-daemon.plugins.media-keys
path=/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings
gsettings set $base.custom-keybinding:$path/workbench-next/ name 'Workbench: next'
gsettings set $base.custom-keybinding:$path/workbench-next/ command "$HOME/.local/bin/workbench-launcher cycle next"
gsettings set $base.custom-keybinding:$path/workbench-next/ binding '<Control><Shift>Right'
gsettings set $base.custom-keybinding:$path/workbench-prev/ name 'Workbench: prev'
gsettings set $base.custom-keybinding:$path/workbench-prev/ command "$HOME/.local/bin/workbench-launcher cycle prev"
gsettings set $base.custom-keybinding:$path/workbench-prev/ binding '<Control><Shift>Left'
# 既存の一覧に2つのパスを追加する（一覧の上書きに注意）
gsettings get $base custom-keybindings
```

Ctrl+Shift+左右はテキスト編集の単語選択と重なるので、常用するなら別のキーを選んでください。

### D-Busインターフェース

上記のツールは、拡張機能がセッションバスに公開する次のインターフェースを呼び出しています。他のツールから直接呼ぶこともできます。

```text
宛先:          org.gnome.Shell
オブジェクト:  /org/gnome/Shell/Extensions/WorkbenchLauncher
インターフェース: org.gnome.Shell.Extensions.WorkbenchLauncher
メソッド:      LaunchWorkbench(s id)
               RaiseWorkbench(s id, b only) -> b raised
               CycleWorkbench(b only, b backward) -> s id
               ListWorkbenches() -> as
               Reload()
```

```bash
gdbus call --session --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/WorkbenchLauncher \
  --method org.gnome.Shell.Extensions.WorkbenchLauncher.LaunchWorkbench sample
```

Waylandでは拡張機能以外のプログラムから他のアプリのウィンドウを動かせないため、外部からの起動はすべてこの経路で拡張機能に依頼する形になっています。

### 「拡張機能は存在しません」と表示される場合

`gnome-extensions enable`で次のように表示される場合は、まだ再ログインしていないことが原因です。

```text
拡張機能 “workbench-launcher@tryandhappy” は存在しません
```

GNOME Shellは拡張ディレクトリをログイン時に走査するため、`install.sh`で置いたばかりのファイルを認識していません。WaylandではShellの再起動ができないので、ログアウトして再ログインした後にもう一度`enable`を実行してください。

## 設定

初回インストール時に以下へサンプル設定が作られます。

```text
~/.config/workbench-launcher/workbenches.json
```

編集後、トップパネルの「設定を再読み込み」を選びます。

### SSHの設定

パスワードをJSONへ書かず、`~/.ssh/config`へ接続先を登録してください。

```sshconfig
Host sample-web
    HostName 192.0.2.10
    User deploy
    IdentityFile ~/.ssh/sample_ed25519

Host sample-app
    HostName 192.0.2.11
    User deploy
    IdentityFile ~/.ssh/sample_ed25519

Host sample-db
    HostName 192.0.2.12
    User deploy
    IdentityFile ~/.ssh/sample_ed25519
```

### workspace

`workspace`は配置先の仮想ワークスペースの番号（1始まり）です。足りない場合は作成します。

GNOMEの既定である動的ワークスペースでは、ウィンドウの無いワークスペースは自動で削除されます。たとえば`workspace: 3`を指定してもワークスペース2が空なら、GNOMEがそれを削除して番号が詰まり、結果的にワークスペース2に並ぶことがあります。ワークベンチのウィンドウは常に同じワークスペースにまとめて配置されるので、番号は「目安」と考えてください。固定したい場合はGNOMEの設定でワークスペースを固定数にします。

### rect

`rect`は対象モニターの作業領域を0～1の割合で指定します。

```json
"rect": { "x": 0.0, "y": 0.0, "width": 0.5, "height": 1.0 }
```

これは「左端から開始して、幅50%、高さ100%」を意味します。解像度やGNOMEの拡大率が変化しても同じ割合になります。

`width`と`height`は省略できます。両方省略すると位置だけを動かし、サイズはアプリが決めたままにします。片方だけ省略した場合は、省略した側の寸法を現在のウィンドウサイズのまま維持します。

```json
"rect": { "x": 0.5, "y": 0.0 }
```

位置だけを指定した場合、ウィンドウが画面からはみ出す位置になるとGNOMEが画面内に収まるよう位置を補正します。たとえば幅の広いウィンドウを`x: 0.5`に置くと、右端が画面に収まる位置まで左へ寄せられます。

`rect`そのものを省略することもできます。その場合は指定した`workspace`と`monitor`へ移動するだけで、位置とサイズはアプリが決めたままにします。

### ウィンドウの識別

以下を組み合わせて識別します。指定した条件はすべて一致する必要があります。

- `appId`：GTK Application ID、Wayland Application ID、Sandbox ID、WM Classのいずれか
- `wmClass`：上記ID群のいずれか
- `titleContains`：ウィンドウタイトルの部分一致

比較は大文字・小文字を区別しない部分一致です。Ghosttyでは起動時に固有の`--class`と`--title`を指定すると安定して識別できます。

`reuseExisting: true`の場合、既に一致するウィンドウがあれば再起動せず再配置します。Firefoxのサンプルでは、普段使いの既存ウィンドウを誤って移動しないよう無効にしています。

## アンインストール

```bash
./uninstall.sh
```

拡張機能を無効化し、拡張本体を`~/.local/share/Trash/files/`へ移動し、`~/.local/bin/workbench-launcher`を削除します。ワークベンチの設定ファイルは消さずに残します。

### ショートカットの削除

`create-shortcut.sh`で作成した`.desktop`ファイルは自動では削除されません。作成した場所に応じて手で削除してください。`<id>`はワークベンチのIDです。

```bash
rm "$(xdg-user-dir DESKTOP)/workbench-launcher-<id>.desktop"       # デスクトップ
rm ~/.local/share/applications/workbench-launcher-<id>.desktop       # アプリ一覧
rm ~/.config/autostart/workbench-launcher-<id>.desktop               # 自動起動
```

特に自動起動用のファイルを残すと、ログインごとにコマンドラインツールが拡張機能への接続を60秒間試み続けます。忘れずに削除してください。

### 設定ファイルの削除

設定も含めて完全に消す場合は、次を実行します。

```bash
rm -r ~/.config/workbench-launcher
```

Shellが読み込み済みの拡張コードはログアウトまでメモリに残ります。パネルアイコンは無効化の時点で消えますが、完全に片付けるには一度再ログインしてください。

## 実装の仕組み

0. パネルメニュー、またはD-Bus経由（ショートカット・CLI・自動起動）で起動要求を受け取る
1. `Gio.Subprocess`で設定されたコマンドを起動
2. Mutterの`window-created`を監視
3. App ID、WM Class、タイトルで新しいウィンドウを照合
4. `Meta.Window`でモニター、ワークスペース、位置、サイズを設定
5. アプリ側が初期サイズを上書きする場合に備え、少し待って2回再適用

通常のアプリからはWayland上の他アプリを移動できませんが、GNOME Shell拡張はMutter内で動くため、`Meta.Window`を利用できます。

## 現時点の制限

- GNOME Shell 50専用です。
- アプリの起動失敗時にはGNOME通知とログを出します。
- アプリによっては起動後に自分で位置を変更し、再配置に失敗する場合があります。
- モニターはGNOME内部の番号で指定します。接続順が変わる環境では、将来的にコネクター名での指定を追加するのが適切です。
- 同じ識別条件のウィンドウを同時に複数起動すると、生成順で割り当てられます。
- サンプル段階のため、GNOME Extensions公式サイトへの公開を前提とした審査対応は行っていません。

## 公開時の変更点

拡張機能のUUIDは `workbench-launcher@tryandhappy` です。フォークして別名で配布する場合は `拡張名@自分のドメインやアカウント名` の形式で固有のものへ変更してください。UUIDは次の4か所に現れます。

- `metadata.json`
- `install.sh`
- `uninstall.sh`
- `Makefile`

D-Busのオブジェクトパスとインターフェース名（`extension.js`と`bin/workbench-launcher`）も、他の拡張と衝突しない固有の名前に変更してください。

サンプル設定のアプリID `org.example.sample.*` や接続先 `sample-web` なども同様に、利用者の環境に合わせて書き換える前提の値です。

## TypeScriptについて

GNOME Shellが実行するのは`extension.js`です。`src/extension.ts`と`types/ambient.d.ts`はTypeScript開発を始めるための雛形で、配布物には依存関係なしで動かせるJavaScript版を同梱しています。

型チェック環境を作る場合：

```bash
npm install
npm run typecheck
```

実装を拡張する際は`extension.js`をTypeScriptへ移植し、ビルド成果物としてJavaScriptを生成する構成にしてください。
