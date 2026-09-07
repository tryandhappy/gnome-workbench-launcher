import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const CONFIG_DIRECTORY = 'workbench-launcher';
const CONFIG_FILE = 'workbenches.json';
const MATCH_RETRY_DELAYS_MS = [150, 400, 900, 1600, 3000, 5000];
const REAPPLY_DELAYS_MS = [350, 1000];

const DBUS_INTERFACE_NAME = 'org.gnome.Shell.Extensions.WorkbenchLauncher';
const DBUS_OBJECT_PATH = '/org/gnome/Shell/Extensions/WorkbenchLauncher';
const DBUS_INTERFACE_XML = `
<node>
  <interface name="${DBUS_INTERFACE_NAME}">
    <method name="LaunchWorkbench">
      <arg type="s" direction="in" name="id"/>
    </method>
    <method name="ListWorkbenches">
      <arg type="as" direction="out" name="ids"/>
    </method>
    <method name="Reload"/>
  </interface>
</node>`;

class WorkbenchLauncherService {
    constructor(extension) {
        this._extension = extension;
    }

    LaunchWorkbench(id) {
        this._extension.launchWorkbenchById(id);
    }

    ListWorkbenches() {
        return this._extension.workbenchIds;
    }

    Reload() {
        this._extension.reload();
    }
}

const WorkbenchIndicator = GObject.registerClass(
class WorkbenchIndicator extends PanelMenu.Button {
    _init(workbenches, onLaunch, onReload) {
        super._init(0.0, 'Workbench Launcher');

        this.add_child(new St.Icon({
            icon_name: 'applications-development-symbolic',
            style_class: 'system-status-icon',
        }));

        const title = new PopupMenu.PopupMenuItem('ワークベンチを起動', {
            reactive: false,
        });
        this.menu.addMenuItem(title);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const workbench of workbenches) {
            const item = new PopupMenu.PopupMenuItem(workbench.name);
            item.connect('activate', () => onLaunch(workbench));
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const reload = new PopupMenu.PopupMenuItem('設定を再読み込み');
        reload.connect('activate', onReload);
        this.menu.addMenuItem(reload);
    }
});

export default class WorkbenchLauncherExtension extends Extension {
    enable() {
        this._indicator = null;
        this._windowCreatedSignal = global.display.connect(
            'window-created',
            (_display, window) => this._scheduleWindowMatching(window)
        );
        this._pending = [];
        this._assignedWindowIds = new Set();
        this._timeoutIds = new Set();
        this._workbenches = [];
        this._reload();
        this._exportDBus();
    }

    disable() {
        if (this._windowCreatedSignal) {
            global.display.disconnect(this._windowCreatedSignal);
            this._windowCreatedSignal = 0;
        }

        for (const timeoutId of this._timeoutIds)
            GLib.Source.remove(timeoutId);

        this._timeoutIds.clear();
        this._pending = [];
        this._assignedWindowIds.clear();
        this._indicator?.destroy();
        this._indicator = null;
        this._unexportDBus();
        this._workbenches = [];
    }

    get workbenchIds() {
        return this._workbenches.map(workbench => workbench.id);
    }

    reload() {
        this._reload();
    }

    launchWorkbenchById(id) {
        const workbench = this._workbenches.find(entry => entry.id === id);
        if (!workbench) {
            const known = this.workbenchIds.join(', ') || '(なし)';
            const message = `ワークベンチ "${id}" は設定にありません。利用可能: ${known}`;
            Main.notifyError('Workbench Launcher', message);
            throw new Error(message);
        }
        this._launchWorkbench(workbench);
    }

    _exportDBus() {
        try {
            this._dbus = Gio.DBusExportedObject.wrapJSObject(
                DBUS_INTERFACE_XML,
                new WorkbenchLauncherService(this)
            );
            this._dbus.export(Gio.DBus.session, DBUS_OBJECT_PATH);
        } catch (error) {
            this._dbus = null;
            logError(error, 'Workbench Launcher: failed to export D-Bus interface');
        }
    }

    _unexportDBus() {
        if (this._dbus) {
            this._dbus.flush();
            this._dbus.unexport();
            this._dbus = null;
        }
    }

    _reload() {
        try {
            const workbenches = this._loadWorkbenches();
            this._workbenches = workbenches;
            this._indicator?.destroy();
            this._indicator = new WorkbenchIndicator(
                workbenches,
                workbench => this._launchWorkbench(workbench),
                () => this._reload()
            );
            Main.panel.addToStatusArea(this.uuid, this._indicator);
            Main.notify('Workbench Launcher', `${workbenches.length}件の設定を読み込みました`);
        } catch (error) {
            Main.notifyError('Workbench Launcher', String(error));
            logError(error, 'Workbench Launcher: configuration error');
        }
    }

    _loadWorkbenches() {
        const path = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            CONFIG_DIRECTORY,
            CONFIG_FILE,
        ]);
        const file = Gio.File.new_for_path(path);
        const [ok, contents] = file.load_contents(null);
        if (!ok)
            throw new Error(`設定を読み込めません: ${path}`);

        const parsed = JSON.parse(new TextDecoder().decode(contents));
        if (!Array.isArray(parsed.workbenches))
            throw new Error('workbenches.json に workbenches 配列がありません');

        for (const workbench of parsed.workbenches)
            this._validateWorkbench(workbench);

        return parsed.workbenches;
    }

    _validateWorkbench(workbench) {
        if (!workbench.id || !workbench.name || !Array.isArray(workbench.apps))
            throw new Error('各ワークベンチには id、name、apps が必要です');

        if (!Number.isInteger(workbench.workspace) || workbench.workspace < 1)
            throw new Error(`${workbench.name}: workspace は1以上の整数にしてください`);

        for (const app of workbench.apps) {
            if (!app.id || !Array.isArray(app.command) || app.command.length === 0)
                throw new Error(`${workbench.name}: 各アプリには id と command が必要です`);
            if (!app.match || !app.rect)
                throw new Error(`${workbench.name}/${app.id}: match と rect が必要です`);

            // x, y は必須。width, height は省略可能で、省略時はサイズを変更せず位置だけ動かす。
            for (const key of ['x', 'y']) {
                if (typeof app.rect[key] !== 'number')
                    throw new Error(`${workbench.name}/${app.id}: rect.${key} が不正です`);
            }
            for (const key of ['width', 'height']) {
                if (app.rect[key] !== undefined && typeof app.rect[key] !== 'number')
                    throw new Error(`${workbench.name}/${app.id}: rect.${key} が不正です`);
            }

            const {x, y, width, height} = app.rect;
            if (x < 0 || y < 0 || x > 1.001 || y > 1.001)
                throw new Error(`${workbench.name}/${app.id}: rect は0～1の範囲で指定してください`);
            if (width !== undefined && (width <= 0 || x + width > 1.001))
                throw new Error(`${workbench.name}/${app.id}: rect.width は0より大きく、x + width が1以下になるようにしてください`);
            if (height !== undefined && (height <= 0 || y + height > 1.001))
                throw new Error(`${workbench.name}/${app.id}: rect.height は0より大きく、y + height が1以下になるようにしてください`);
        }
    }

    _launchWorkbench(workbench) {
        const workspaceIndex = workbench.workspace - 1;
        this._ensureWorkspace(workspaceIndex);

        for (const app of workbench.apps) {
            const rule = {...app, workspaceIndex};
            const existing = app.reuseExisting ? this._findExistingWindow(rule) : null;

            if (existing) {
                this._placeWindow(existing, rule);
                continue;
            }

            this._pending.push({rule, assigned: false});
            try {
                Gio.Subprocess.new(app.command, Gio.SubprocessFlags.NONE);
            } catch (error) {
                this._pending = this._pending.filter(entry => entry.rule !== rule);
                Main.notifyError(
                    'Workbench Launcher',
                    `${app.id} を起動できません: ${String(error)}`
                );
                logError(error, `Workbench Launcher: failed to launch ${app.id}`);
            }
        }

        this._addTimeout(1300, () => {
            const workspace = global.workspace_manager.get_workspace_by_index(workspaceIndex);
            workspace?.activate(global.get_current_time());
        });
    }

    _scheduleWindowMatching(window) {
        for (const delay of MATCH_RETRY_DELAYS_MS)
            this._addTimeout(delay, () => this._tryAssignWindow(window));
    }

    _tryAssignWindow(window) {
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL)
            return;

        const stableId = String(window.get_stable_sequence());
        if (this._assignedWindowIds.has(stableId))
            return;

        const pending = this._pending.find(entry =>
            !entry.assigned && this._windowMatches(window, entry.rule.match)
        );
        if (!pending)
            return;

        pending.assigned = true;
        this._assignedWindowIds.add(stableId);
        this._pending = this._pending.filter(entry => entry !== pending);
        this._placeWindow(window, pending.rule);
    }

    _findExistingWindow(rule) {
        for (const actor of global.get_window_actors()) {
            const window = actor.meta_window;
            if (window.get_window_type() === Meta.WindowType.NORMAL &&
                this._windowMatches(window, rule.match))
                return window;
        }
        return null;
    }

    _windowMatches(window, match) {
        const appIds = [
            window.get_gtk_application_id?.(),
            window.get_sandboxed_app_id?.(),
            window.get_wm_class?.(),
            window.get_wm_class_instance?.(),
        ].filter(Boolean).map(value => String(value).toLowerCase());
        const title = String(window.get_title?.() ?? '').toLowerCase();

        if (match.appId && !appIds.some(value => value.includes(match.appId.toLowerCase())))
            return false;
        if (match.wmClass && !appIds.some(value => value.includes(match.wmClass.toLowerCase())))
            return false;
        if (match.titleContains && !title.includes(match.titleContains.toLowerCase()))
            return false;
        return Boolean(match.appId || match.wmClass || match.titleContains);
    }

    _placeWindow(window, rule) {
        const apply = () => {
            if (!window)
                return;

            this._ensureWorkspace(rule.workspaceIndex);
            const workspace = global.workspace_manager.get_workspace_by_index(rule.workspaceIndex);
            const monitorCount = global.display.get_n_monitors();
            const monitor = Math.min(Math.max(rule.monitor ?? 0, 0), monitorCount - 1);

            window.unmaximize();
            window.move_to_monitor(monitor);
            window.change_workspace(workspace);

            const area = workspace.get_work_area_for_monitor(monitor);
            const x = area.x + Math.round(area.width * rule.rect.x);
            const y = area.y + Math.round(area.height * rule.rect.y);

            // width / height が両方省略されていれば位置だけ移動し、サイズはアプリ任せにする。
            if (rule.rect.width === undefined && rule.rect.height === undefined) {
                window.move_frame(false, x, y);
            } else {
                const frame = window.get_frame_rect();
                const width = rule.rect.width === undefined
                    ? frame.width
                    : Math.max(100, Math.round(area.width * rule.rect.width));
                const height = rule.rect.height === undefined
                    ? frame.height
                    : Math.max(100, Math.round(area.height * rule.rect.height));
                window.move_resize_frame(false, x, y, width, height);
            }

            if (rule.maximized)
                window.maximize();
        };

        apply();
        for (const delay of REAPPLY_DELAYS_MS)
            this._addTimeout(delay, apply);
    }

    _ensureWorkspace(index) {
        const manager = global.workspace_manager;
        while (manager.get_n_workspaces() <= index)
            manager.append_new_workspace(false, global.get_current_time());
    }

    _addTimeout(delayMs, callback) {
        let timeoutId = 0;
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._timeoutIds.delete(timeoutId);
            try {
                callback();
            } catch (error) {
                logError(error, 'Workbench Launcher: delayed operation failed');
            }
            return GLib.SOURCE_REMOVE;
        });
        this._timeoutIds.add(timeoutId);
    }
}
