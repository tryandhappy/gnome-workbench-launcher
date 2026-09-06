import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

interface RelativeRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface WindowMatch {
    appId?: string;
    wmClass?: string;
    titleContains?: string;
}

interface AppRule {
    id: string;
    command: string[];
    match: WindowMatch;
    reuseExisting?: boolean;
    monitor?: number;
    rect: RelativeRect;
    maximized?: boolean;
    workspaceIndex?: number;
}

interface Workbench {
    id: string;
    name: string;
    workspace: number;
    apps: AppRule[];
}

interface WorkbenchFile {
    workbenches: Workbench[];
}

// extension.js is the prebuilt runtime version of this TypeScript source.
// See README.md for the architecture and build instructions.
// The implementation intentionally mirrors extension.js so the sample can be
// installed without npm. Install @girs/gjs and @girs/gnome-shell, then copy the
// runtime implementation here when extending the sample with strict GJS types.

export type {AppRule, Workbench, WorkbenchFile, RelativeRect, WindowMatch};

export default class WorkbenchLauncherExtension extends Extension {
    enable(): void {
        Main.notify('Workbench Launcher', 'Use the prebuilt extension.js runtime');
        new St.Icon({icon_name: 'applications-development-symbolic'});
        void Gio;
        void GLib;
        void Meta;
        void PanelMenu;
        void PopupMenu;
    }

    disable(): void {}
}
