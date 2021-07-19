/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProfilerService } from 'sql/workbench/services/profiler/browser/interfaces';
import { IProfilerController } from 'sql/workbench/contrib/profiler/common/interfaces';
import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';
import { Task } from 'sql/workbench/services/tasks/browser/tasksRegistry';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';

export class ProfilerConnect extends Action {
	private static readonly ConnectText = nls.localize('profilerAction.connect', "Connect");
	private static readonly DisconnectText = nls.localize('profilerAction.disconnect', "Disconnect");

	public static ID = 'profiler.connect';
	public static LABEL = ProfilerConnect.ConnectText;

	private _connected: boolean = false;

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'connect');
	}

	public override async run(input: ProfilerInput): Promise<void> {
		this.enabled = false;
		if (!this._connected) {
			await this._profilerService.connectSession(input.id);
			this.enabled = true;
			this.connected = true;
			input.state.change({ isConnected: true, isRunning: false, isPaused: false, isStopped: true });
		} else {
			await this._profilerService.disconnectSession(input.id);
			this.enabled = true;
			this.connected = false;
			input.state.change({ isConnected: false, isRunning: false, isPaused: false, isStopped: false });
		}
	}

	public set connected(value: boolean) {
		this._connected = value;
		this._setClass(value ? 'disconnect' : 'connect');
		this.label = value ? ProfilerConnect.DisconnectText : ProfilerConnect.ConnectText;
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

	public override async run(input: ProfilerInput): Promise<void> {
		input.data.clear();
		await this._profilerService.startSession(input.id, input.sessionName);
	}
}

export class ProfilerCreate extends Action {
	public static ID = 'profiler.create';
	public static LABEL = nls.localize('create', "New Session");

	constructor(
		id: string, label: string,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super(id, label, 'add');
	}

	public override async run(input: ProfilerInput): Promise<void> {
		return this._profilerService.launchCreateSessionDialog(input);
	}
}

export class ProfilerPause extends Action {
	private static readonly PauseText = nls.localize('profilerAction.pauseCapture', "Pause");
	private static readonly ResumeText = nls.localize('profilerAction.resumeCapture', "Resume");
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

	public override async run(input: ProfilerInput): Promise<void> {
		await this._profilerService.pauseSession(input.id);
		this.paused = !this._paused;
		input.state.change({ isPaused: this.paused, isStopped: false, isRunning: !this.paused });
	}

	public set paused(value: boolean) {
		this._paused = value;
		this._setClass(value ? ProfilerPause.ResumeCssClass : ProfilerPause.PauseCssClass);
		this.label = value ? ProfilerPause.ResumeText : ProfilerPause.PauseText;
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

	public override async run(input: ProfilerInput): Promise<void> {
		await this._profilerService.stopSession(input.id);
	}
}

export class ProfilerClear extends Action {
	public static ID = 'profiler.clear';
	public static LABEL = nls.localize('profiler.clear', "Clear Data");

	constructor(id: string,
		label: string,
		@IDialogService private _dialogService: IDialogService) {
		super(id, label, 'clear-results');
	}

	override async run(input: ProfilerInput): Promise<void> {
		const result = await this._dialogService.confirm({
			type: 'question',
			message: nls.localize('profiler.clearDataPrompt', "Are you sure you want to clear the data?")
		});
		if (result.confirmed) {
			input.data.clear();
		}
	}
}

export class ProfilerAutoScroll extends Action {
	private static readonly AutoScrollOnText = nls.localize('profilerAction.autoscrollOn', "Auto Scroll: On");
	private static readonly AutoScrollOffText = nls.localize('profilerAction.autoscrollOff', "Auto Scroll: Off");
	private static readonly CheckedCssClass = 'sql checked';

	public static ID = 'profiler.autoscroll';
	public static LABEL = ProfilerAutoScroll.AutoScrollOnText;

	constructor(id: string, label: string) {
		super(id, label, ProfilerAutoScroll.CheckedCssClass);
	}

	override async run(input: ProfilerInput): Promise<void> {
		this.checked = !this.checked;
		this.label = this.checked ? ProfilerAutoScroll.AutoScrollOnText : ProfilerAutoScroll.AutoScrollOffText;
		this._setClass(this.checked ? ProfilerAutoScroll.CheckedCssClass : '');
		input.state.change({ autoscroll: this.checked });
	}
}

export class ProfilerCollapsablePanelAction extends Action {
	public static ID = 'profiler.toggleCollapsePanel';
	public static LABEL = nls.localize('profiler.toggleCollapsePanel', "Toggle Collapsed Panel");

	private _collapsed: boolean;

	constructor(id: string, label: string) {
		super(id, label, 'codicon-chevron-down');
	}

	public override async run(input: ProfilerInput): Promise<void> {
		this.collapsed = !this._collapsed;
		input.state.change({ isPanelCollapsed: this._collapsed });
	}

	get collapsed(): boolean {
		return this._collapsed;
	}

	set collapsed(val: boolean) {
		this._collapsed = val === false ? false : true;
		this._setClass(this._collapsed ? 'codicon-chevron-up' : 'codicon-chevron-down');
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

	public override async run(input: ProfilerInput): Promise<void> {
		await this._profilerService.launchColumnEditor(input);
	}
}

export class ProfilerFindNext implements IEditorAction {
	public readonly id = 'profiler.findNext';
	public readonly label = nls.localize('profiler.findNext', "Find Next String");
	public readonly alias = '';

	constructor(private profiler: IProfilerController) { }

	async run(): Promise<void> {
		this.profiler.findNext();
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

	async run(): Promise<void> {
		this.profiler.findPrevious();
	}

	isSupported(): boolean {
		return true;
	}
}

export class NewProfilerAction extends Task {
	public static readonly ID = 'profiler.newProfiler';
	public static readonly LABEL = nls.localize('profilerAction.newProfiler', "Launch Profiler");
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

	public async runTask(accessor: ServicesAccessor, profile: IConnectionProfile): Promise<void> {
		let profilerInput = accessor.get<IInstantiationService>(IInstantiationService).createInstance(ProfilerInput, profile);
		await accessor.get<IEditorService>(IEditorService).openEditor(profilerInput, { pinned: true }, ACTIVE_GROUP);
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showConnectionDialogOnError: true,
			showDashboard: false,
			showFirewallRuleOnError: true
		};
		await accessor.get<IConnectionManagementService>(IConnectionManagementService).connect(this._connectionProfile, profilerInput.id, options);
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

	public override async run(input: ProfilerInput): Promise<void> {
		this._profilerService.launchFilterSessionDialog(input);
	}
}

export class ProfilerClearSessionFilter extends Action {
	public static ID = 'profiler.clearFilter';
	public static LABEL = nls.localize('profiler.clearFilter', "Clear Filter");

	constructor(
		id: string,
		label: string,
		@IDialogService private _dialogService: IDialogService
	) {
		super(id, label, 'clear-filter');
	}

	public override async run(input: ProfilerInput): Promise<void> {
		const result = await this._dialogService.confirm({
			type: 'question',
			message: nls.localize('profiler.clearFilterPrompt', "Are you sure you want to clear the filters?")
		});
		if (result.confirmed) {
			input.clearFilter();
		}
	}
}
