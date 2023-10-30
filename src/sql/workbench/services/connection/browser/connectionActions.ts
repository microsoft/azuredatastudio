/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import { Action } from 'vs/base/common/actions';
import { Event, Emitter } from 'vs/base/common/event';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { INotificationService, INotificationActions } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { IDialogService, IConfirmation, IConfirmationResult } from 'vs/platform/dialogs/common/dialogs';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { EditDataInput } from 'sql/workbench/browser/editData/editDataInput';
import { DashboardInput } from 'sql/workbench/browser/editor/profiler/dashboardInput';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { Action2 } from 'vs/platform/actions/common/actions';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { FileAccess } from 'vs/base/common/network';

/**
 * Workbench action to clear the recent connnections list
 */
// {{SQL CARBON TODO}} - remove old action that is used by ActionBar class
export class ClearRecentConnectionsAction1 extends Action {

	public static ID = 'clearRecentConnectionsAction';
	public static LABEL = nls.localize('ClearRecentlyUsedLabel', "Clear List");
	public static ICON = 'search-action clear-search-results';

	private _onRecentConnectionsRemoved = new Emitter<void>();
	public onRecentConnectionsRemoved: Event<void> = this._onRecentConnectionsRemoved.event;

	private _useConfirmationMessage = false;

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@INotificationService private _notificationService: INotificationService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@IDialogService private _dialogService: IDialogService,
	) {
		super(id, label, ClearRecentConnectionsAction1.ICON);
		this.enabled = true;
	}

	public set useConfirmationMessage(value: boolean) {
		this._useConfirmationMessage = value;
	}

	public override run(): Promise<void> {
		if (this._useConfirmationMessage) {
			return this.promptConfirmationMessage().then(result => {
				if (result.confirmed) {
					this._connectionManagementService.clearRecentConnectionsList();
					this._onRecentConnectionsRemoved.fire();
				}
			});
		} else {
			return this.promptQuickOpenService().then(result => {
				if (result) {
					this._connectionManagementService.clearRecentConnectionsList();

					const actions: INotificationActions = { primary: [] };
					this._notificationService.notify({
						severity: Severity.Info,
						message: nls.localize('ClearedRecentConnections', "Recent connections list cleared"),
						actions
					});
					this._onRecentConnectionsRemoved.fire();
				}
			});
		}
	}

	private promptQuickOpenService(): Promise<boolean> {
		const self = this;
		return new Promise<boolean>((resolve, reject) => {
			let choices: { key, value }[] = [
				{ key: nls.localize('connectionAction.yes', "Yes"), value: true },
				{ key: nls.localize('connectionAction.no', "No"), value: false }
			];

			self._quickInputService.pick(choices.map(x => x.key), { placeHolder: nls.localize('ClearRecentlyUsedLabel', "Clear List"), ignoreFocusLost: true }).then((choice) => {
				let confirm = choices.find(x => x.key === choice);
				resolve(confirm && confirm.value);
			});
		});
	}

	private promptConfirmationMessage(): Promise<IConfirmationResult> {
		let confirm: IConfirmation = {
			message: nls.localize('clearRecentConnectionMessage', "Are you sure you want to delete all the connections from the list?"),
			primaryButton: nls.localize('connectionDialog.yes', "Yes"),
			cancelButton: nls.localize('connectionDialog.no', "No"),
			type: 'question'
		};

		return new Promise<IConfirmationResult>((resolve, reject) => {
			this._dialogService.confirm(confirm).then((confirmed) => {
				resolve(confirmed);
			});
		});
	}
}

/**
 * Workbench action to clear the recent connnections list
 */
export class ClearRecentConnectionsAction extends Action2 {

	public static ID = 'clearRecentConnectionsAction';
	public static LABEL_ORG = 'Clear List';
	public static LABEL = nls.localize('ClearRecentlyUsedLabel', "Clear List");
	public static ICON = 'search-action clear-search-results';

	private _onRecentConnectionsRemoved = new Emitter<void>();
	public onRecentConnectionsRemoved: Event<void> = this._onRecentConnectionsRemoved.event;

	private _useConfirmationMessage = false;

	constructor() {
		super({
			id: ClearRecentConnectionsAction.ID,
			// {{SQL CARBON TODO}} - does this work for icons?
			icon: {
				light: FileAccess.asBrowserUri(`sql/workbench/services/connection/browser/media/clear-search-results.svg`),
				dark: FileAccess.asBrowserUri(`sql/workbench/services/connection/browser/media/clear-search-results-dark.svg`)
			},
			title: { value: ClearRecentConnectionsAction.LABEL, original: ClearRecentConnectionsAction.LABEL_ORG },
			f1: true
		});
	}

	public set useConfirmationMessage(value: boolean) {
		this._useConfirmationMessage = value;
	}

	public override run(accessor: ServicesAccessor): Promise<void> {
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const notificationService = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);
		const dialogService = accessor.get(IDialogService);

		if (this._useConfirmationMessage) {
			return this.promptConfirmationMessage(dialogService).then(result => {
				if (result.confirmed) {
					connectionManagementService.clearRecentConnectionsList();
					this._onRecentConnectionsRemoved.fire();
				}
			});
		} else {
			return this.promptQuickOpenService(quickInputService).then(result => {
				if (result) {
					connectionManagementService.clearRecentConnectionsList();

					const actions: INotificationActions = { primary: [] };
					notificationService.notify({
						severity: Severity.Info,
						message: nls.localize('ClearedRecentConnections', "Recent connections list cleared"),
						actions
					});
					this._onRecentConnectionsRemoved.fire();
				}
			});
		}
	}

	private promptQuickOpenService(quickInputService: IQuickInputService): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			let choices: { key, value }[] = [
				{ key: nls.localize('connectionAction.yes', "Yes"), value: true },
				{ key: nls.localize('connectionAction.no', "No"), value: false }
			];

			quickInputService.pick(choices.map(x => x.key), { placeHolder: nls.localize('ClearRecentlyUsedLabel', "Clear List"), ignoreFocusLost: true }).then((choice) => {
				let confirm = choices.find(x => x.key === choice);
				resolve(confirm && confirm.value);
			});
		});
	}

	private promptConfirmationMessage(dialogService: IDialogService): Promise<IConfirmationResult> {
		let confirm: IConfirmation = {
			message: nls.localize('clearRecentConnectionMessage', "Are you sure you want to delete all the connections from the list?"),
			primaryButton: nls.localize('connectionDialog.yes', "Yes"),
			cancelButton: nls.localize('connectionDialog.no', "No"),
			type: 'question'
		};

		return new Promise<IConfirmationResult>((resolve, reject) => {
			dialogService.confirm(confirm).then((confirmed) => {
				resolve(confirmed);
			});
		});
	}
}

/**
 * Action to delete one recently used connection from the MRU
 */
export class ClearSingleRecentConnectionAction extends Action {

	public static ID = 'clearSingleRecentConnectionAction';
	public static LABEL = nls.localize('delete', "Delete");
	private _onRecentConnectionRemoved = new Emitter<void>();
	public onRecentConnectionRemoved: Event<void> = this._onRecentConnectionRemoved.event;

	constructor(
		id: string,
		label: string,
		private _connectionProfile: IConnectionProfile,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			resolve(this._connectionManagementService.clearRecentConnection(this._connectionProfile));
			this._onRecentConnectionRemoved.fire();
		});
	}
}

/**
 * Action to retrieve the current connection string
 */
export class GetCurrentConnectionStringAction extends Action2 {

	public static ID = 'getCurrentConnectionStringAction';
	public static LABEL_ORG = 'Get Current Connection String';
	public static LABEL = nls.localize('connectionAction.GetCurrentConnectionString', "Get Current Connection String");

	constructor() {
		super({
			id: GetCurrentConnectionStringAction.ID,
			title: { value: GetCurrentConnectionStringAction.LABEL, original: GetCurrentConnectionStringAction.LABEL_ORG },
			f1: true
		});
	}

	public override run(accessor: ServicesAccessor): Promise<void> {
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const editorService = accessor.get(IEditorService);
		const notificationService = accessor.get(INotificationService);
		const clipboardService = accessor.get(IClipboardService);

		return new Promise<void>((resolve, reject) => {
			let activeInput = editorService.activeEditor;
			if (activeInput && (activeInput instanceof QueryEditorInput || activeInput instanceof EditDataInput || activeInput instanceof DashboardInput)
				&& connectionManagementService.isConnected(activeInput.uri)) {
				let includePassword = false;
				let connectionProfile = connectionManagementService.getConnectionProfile(activeInput.uri);
				connectionManagementService.getConnectionString(connectionProfile.id, includePassword).then(result => {

					//Copy to clipboard
					clipboardService.writeText(result);

					let message = result
						? result
						: nls.localize('connectionAction.connectionString', "Connection string not available");
					notificationService.info(message);
				});
			} else {
				let message = nls.localize('connectionAction.noConnection', "No active connection available");
				notificationService.info(message);
			}
		});
	}
}
