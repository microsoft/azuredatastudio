/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IProfilerService } from 'sql/parts/profiler/service/interfaces';
import { IProfilerController } from 'sql/parts/profiler/editor/controller/interfaces';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { BaseActionContext } from 'sql/workbench/common/actions';
import { Task } from 'sql/platform/tasks/common/tasks';
import { ObjectExplorerActionsContext } from 'sql/parts/objectExplorer/viewlet/objectExplorerActions';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

export class ProfilerConnect extends Action {
	public static ID = 'profiler.connect';
	public static LABEL = nls.localize('profiler.connect', "Connect");

	private _connected: boolean = false;

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'connect');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		this.enabled = false;
		if (!this._connected) {
			return TPromise.wrap(this._profilerService.connectSession(input.id).then(() => {
				this.enabled = true;
				this.connected = true;
				input.state.change({ isConnected: true, isRunning: false, isPaused: false, isStopped: true });
				return true;
			}));
		} else {
			return TPromise.wrap(this._profilerService.disconnectSession(input.id).then(() => {
				this.enabled = true;
				this.connected = false;
				input.state.change({ isConnected: false, isRunning: false, isPaused: false, isStopped: false });
				return true;
			}));
		}
	}

	public set connected(value: boolean) {
		this._connected = value;
		this._setClass(value ? 'disconnect' : 'connect');
		this._setLabel(value ? nls.localize('profilerAction.disconnect', 'Disconnected') : nls.localize('profilerAction.connect', "Connect"));
	}

	public get connected(): boolean {
		return this._connected;
	}
}

export class ProfilerStart extends Action {
	public static ID = 'profiler.start';
	public static LABEL = nls.localize('start', "Start");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'start');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		this.enabled = false;
		input.data.clear();
		return TPromise.wrap(this._profilerService.startSession(input.id).then(() => {
			input.state.change({ isRunning: true, isStopped: false, isPaused: false });
			return true;
		}));
	}

}

export class ProfilerPause extends Action {
	public static ID = 'profiler.pause';
	public static LABEL = nls.localize('pause', "Pause");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'stop');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		this.enabled = false;
		return TPromise.wrap(this._profilerService.pauseSession(input.id).then(() => {
			input.state.change({ isPaused: true, isStopped: false, isRunning: false });
			return true;
		}));
	}
}

export class ProfilerStop extends Action {
	public static ID = 'profiler.stop';
	public static LABEL = nls.localize('profilerStop.stop', "Stop");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'stop');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		this.enabled = false;
		return TPromise.wrap(this._profilerService.stopSession(input.id).then(() => {
			input.state.change({ isStopped: true, isPaused: false, isRunning: false });
			return true;
		}));
	}
}

export class ProfilerClear extends Action {
	public static ID = 'profiler.clear';
	public static LABEL = nls.localize('profiler.clear', "Clear Data");

	constructor(id: string, label: string) {
		super(id, label, 'stop');
	}

	run(input: ProfilerInput): TPromise<void> {
		input.data.clear();
		return TPromise.as(null);
	}
}

export class ProfilerAutoScroll extends Action {
	public static ID = 'profiler.autoscroll';
	public static LABEL = nls.localize('profiler.toggleAutoscroll', "Toggle Auto Scroll");

	constructor(id: string, label: string) {
		super(id, label, 'stop');
	}

	run(input: ProfilerInput): TPromise<boolean> {
		this.checked = !this.checked;
		input.state.change({ autoscroll: this.checked });
		return TPromise.as(true);
	}
}

export class ProfilerCollapsablePanelAction extends Action {
	public static ID = 'profiler.toggleCollapsePanel';
	public static LABEL = nls.localize('profiler.toggleCollapsePanel', "Toggle Collapsed Panel");

	private _collapsed: boolean;

	constructor(id: string, label: string) {
		super(id, label, 'minimize-panel-action');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		this.collapsed = !this._collapsed;
		input.state.change({ isPanelCollapsed: this._collapsed });
		return TPromise.as(true);
	}

	set collapsed(val: boolean) {
		this._collapsed = val === false ? false : true;
		this._setClass(this._collapsed ? 'maximize-panel-action' : 'minimize-panel-action');
	}
}

export class ProfilerEditColumns extends Action {
	public static ID = 'profiler.';
	public static LABEL = nls.localize('profiler.editColumns', "Edit Columns");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label);
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		return TPromise.wrap(this._profilerService.launchColumnEditor(input)).then(() => true);
	}
}

export class ProfilerFindNext implements IEditorAction {
	public readonly id = 'profiler.findNext';
	public readonly label = nls.localize('profiler.findNext', "Find Next String");
	public readonly alias = '';

	constructor(private profiler: IProfilerController) { }

	run(): TPromise<void> {
		this.profiler.findNext();
		return TPromise.as(null);
	}

	isSupported(): boolean {
		return true;
	}
}

export class ProfilerFindPrevious implements IEditorAction {
	public readonly id = 'profiler.findPrevious';
	public readonly label = nls.localize('profiler.findPrevious', "Find Previous String");
	public readonly alias = '';

	constructor(private profiler: IProfilerController) { }

	run(): TPromise<void> {
		this.profiler.findPrevious();
		return TPromise.as(null);
	}

	isSupported(): boolean {
		return true;
	}
}

export class NewProfilerAction extends Task {
	public static readonly ID = 'profiler.newProfiler';
	public static readonly LABEL = nls.localize('profilerAction.newProfiler', 'New Profiler');
	public static readonly ICON = 'profile';

	private _connectionProfile: ConnectionProfile;

	constructor() {
		super({
			id: NewProfilerAction.ID,
			title: NewProfilerAction.LABEL,
			iconPath: { dark: NewProfilerAction.ICON, light: NewProfilerAction.ICON },
			iconClass: NewProfilerAction.ICON
		});
	}

	public runTask(accessor: ServicesAccessor, profile: IConnectionProfile): TPromise<void> {
		let profilerInput = accessor.get<IInstantiationService>(IInstantiationService).createInstance(ProfilerInput, profile);
		return accessor.get<IWorkbenchEditorService>(IWorkbenchEditorService).openEditor(profilerInput, { pinned: true }, false).then(() => {
			let options: IConnectionCompletionOptions = {
				params: undefined,
				saveTheConnection: false,
				showConnectionDialogOnError: true,
				showDashboard: false,
				showFirewallRuleOnError: true
			};
			accessor.get<IConnectionManagementService>(IConnectionManagementService).connect(this._connectionProfile, profilerInput.id, options);

			return TPromise.as(void 0);
		});
	}
}
