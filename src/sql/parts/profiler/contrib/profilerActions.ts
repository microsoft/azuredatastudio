/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!sql/parts/profiler/media/profiler';
import { IProfilerService } from 'sql/workbench/services/profiler/common/interfaces';
import { IProfilerController } from 'sql/parts/profiler/editor/controller/interfaces';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { Task } from 'sql/platform/tasks/common/tasks';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';

export class ProfilerConnect extends Action {
	private static readonly ConnectText = nls.localize('profilerAction.connect', 'Connect');
	private static readonly DisconnectText = nls.localize('profilerAction.disconnect', 'Disconnect');

	public static ID = 'profiler.connect';
	public static LABEL = ProfilerConnect.ConnectText;

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
		this._setLabel(value ? ProfilerConnect.DisconnectText : ProfilerConnect.ConnectText);
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
		super(id, label, 'sql start');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		input.data.clear();
		return TPromise.wrap(this._profilerService.startSession(input.id, input.sessionName));
	}
}

export class ProfilerCreate extends Action {
	public static ID = 'profiler.create';
	public static LABEL = nls.localize('create', "New Session");

	constructor(
		id: string, label: string,
		@ICommandService private _commandService: ICommandService,
		@IProfilerService private _profilerService: IProfilerService,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, label, 'add');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		return TPromise.wrap(this._profilerService.launchCreateSessionDialog(input).then(() => {
			return true;
		}));
	}
}

export class ProfilerPause extends Action {
	private static readonly PauseText = nls.localize('profilerAction.pauseCapture', 'Pause');
	private static readonly ResumeText = nls.localize('profilerAction.resumeCapture', 'Resume');
	private static readonly PauseCssClass = 'sql pause';
	private static readonly ResumeCssClass = 'sql continue';

	public static ID = 'profiler.pause';
	public static LABEL = ProfilerPause.PauseText;

	private _paused: boolean = false;

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, ProfilerPause.PauseCssClass);
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		return TPromise.wrap(this._profilerService.pauseSession(input.id).then(() => {
			this.paused = !this._paused;
			input.state.change({ isPaused: this.paused, isStopped: false, isRunning: !this.paused });
			return true;
		}));
	}

	public set paused(value: boolean) {
		this._paused = value;
		this._setClass(value ? ProfilerPause.ResumeCssClass : ProfilerPause.PauseCssClass);
		this._setLabel(value ? ProfilerPause.ResumeText : ProfilerPause.PauseText);
	}

	public get paused(): boolean {
		return this._paused;
	}
}

export class ProfilerStop extends Action {
	public static ID = 'profiler.stop';
	public static LABEL = nls.localize('profilerStop.stop', "Stop");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'sql stop');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		return TPromise.wrap(this._profilerService.stopSession(input.id));
	}
}

export class ProfilerClear extends Action {
	public static ID = 'profiler.clear';
	public static LABEL = nls.localize('profiler.clear', "Clear Data");

	constructor(id: string, label: string) {
		super(id, label, 'clear-results');
	}

	run(input: ProfilerInput): TPromise<void> {
		input.data.clear();
		return TPromise.as(null);
	}
}

export class ProfilerAutoScroll extends Action {
	private static readonly AutoScrollOnText = nls.localize('profilerAction.autoscrollOn', 'Auto Scroll: On');
	private static readonly AutoScrollOffText = nls.localize('profilerAction.autoscrollOff', 'Auto Scroll: Off');
	private static readonly CheckedCssClass = 'sql checked';

	public static ID = 'profiler.autoscroll';
	public static LABEL = ProfilerAutoScroll.AutoScrollOnText;

	constructor(id: string, label: string) {
		super(id, label, ProfilerAutoScroll.CheckedCssClass);
	}

	run(input: ProfilerInput): TPromise<boolean> {
		this.checked = !this.checked;
		this._setLabel(this.checked ? ProfilerAutoScroll.AutoScrollOnText : ProfilerAutoScroll.AutoScrollOffText);
		this._setClass(this.checked ? ProfilerAutoScroll.CheckedCssClass : '');
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

	run(): Promise<void> {
		this.profiler.findNext();
		return Promise.resolve(null);
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

	run(): Promise<void> {
		this.profiler.findPrevious();
		return Promise.resolve(null);
	}

	isSupported(): boolean {
		return true;
	}
}

export class NewProfilerAction extends Task {
	public static readonly ID = 'profiler.newProfiler';
	public static readonly LABEL = nls.localize('profilerAction.newProfiler', 'Launch Profiler');
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
		return accessor.get<IEditorService>(IEditorService).openEditor(profilerInput, { pinned: true }, ACTIVE_GROUP).then(() => {
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

export class ProfilerFilterSession extends Action {
	public static ID = 'profiler.filter';
	public static LABEL = nls.localize('profiler.filter', "Filter…");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'filterLabel');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		this._profilerService.launchFilterSessionDialog(input);
		return TPromise.wrap(true);
	}
}

export class ProfilerClearSessionFilter extends Action {
	public static ID = 'profiler.clearFilter';
	public static LABEL = nls.localize('profiler.clearFilter', "Clear Filter");

	constructor(
		id: string, label: string
	) {
		super(id, label, 'clear-filter');
	}

	public run(input: ProfilerInput): TPromise<boolean> {
		input.clearFilter();
		return TPromise.wrap(true);
	}
}
