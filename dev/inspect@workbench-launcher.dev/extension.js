// 開発用の検査拡張。dev/nested-test.sh が入れ子の GNOME Shell に読み込ませ、
// ウィンドウの位置・ワークスペースと、起動後のイベント履歴を JSON で返す。
// 実セッションに入れることは想定していない。
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const IFACE = `
<node>
  <interface name="dev.workbenchLauncher.Inspect">
    <method name="Dump"><arg type="s" direction="out" name="json"/></method>
  </interface>
</node>`;

export default class InspectExtension extends Extension {
    enable() {
        this._t0 = GLib.get_monotonic_time();
        this._events = [];
        this._dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);
        this._dbus.export(Gio.DBus.session, '/dev/workbenchLauncher/Inspect');

        const manager = global.workspace_manager;
        this._windowCreated = global.display.connect('window-created', (_display, window) => {
            const tag = () => `${window.get_wm_class()}#${window.get_stable_sequence()}`;
            const geometry = () => {
                const r = window.get_frame_rect();
                return `${r.x},${r.y} ${r.width}x${r.height} max=${window.is_maximized()}`;
            };
            this._log(`created ${tag()} type=${window.get_window_type()} ws=${this._wsIndex(window)}`);
            window.connect('workspace-changed', () =>
                this._log(`ws-changed ${tag()} -> ws=${this._wsIndex(window)} active=${manager.get_active_workspace_index() + 1}`));
            window.connect('position-changed', () => this._log(`pos ${tag()} ${geometry()}`));
            window.connect('size-changed', () => this._log(`size ${tag()} ${geometry()}`));
        });
        this._managerSignals = [
            manager.connect('active-workspace-changed', () =>
                this._log(`active-ws -> ${manager.get_active_workspace_index() + 1}`)),
            manager.connect('workspace-added', (_m, i) =>
                this._log(`workspace-added index=${i + 1} n=${manager.get_n_workspaces()}`)),
            manager.connect('workspace-removed', (_m, i) =>
                this._log(`workspace-removed index=${i + 1} n=${manager.get_n_workspaces()}`)),
        ];
    }

    disable() {
        this._dbus?.unexport();
        this._dbus = null;
        global.display.disconnect(this._windowCreated);
        for (const id of this._managerSignals)
            global.workspace_manager.disconnect(id);
        this._events = [];
    }

    _wsIndex(window) {
        const ws = window.get_workspace();
        return ws ? ws.index() + 1 : null;
    }

    _log(message) {
        const ms = ((GLib.get_monotonic_time() - this._t0) / 1000).toFixed(0).padStart(6);
        this._events.push(`${ms}ms ${message}`);
    }

    Dump() {
        const manager = global.workspace_manager;
        const launcher = Main.extensionManager.lookup('workbench-launcher@tryandhappy')?.stateObj;
        return JSON.stringify({
            pending: launcher?._pending?.map(entry => entry.rule.id) ?? 'n/a',
            activeWorkspace: manager.get_active_workspace_index() + 1,
            workspaces: manager.get_n_workspaces(),
            windows: global.get_window_actors().map(actor => {
                const w = actor.meta_window;
                const r = w.get_frame_rect();
                return {
                    wmClass: w.get_wm_class(), appId: w.get_gtk_application_id(), title: w.get_title(),
                    workspace: this._wsIndex(w), monitor: w.get_monitor(),
                    x: r.x, y: r.y, width: r.width, height: r.height, maximized: w.is_maximized(),
                };
            }),
            events: this._events,
        }, null, 1);
    }
}
