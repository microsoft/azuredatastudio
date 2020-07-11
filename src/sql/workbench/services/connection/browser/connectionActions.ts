/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
import { find } from 'vs/base/common/arrays';

/**
 * Workbench action to clear the recent connnections list
 */
export class ClearRecentConnectionsAction extends Action {

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
		super(id, label, ClearRecentConnectionsAction.ICON);
		this.enabled = true;
	}

	public set useConfirmationMessage(value: boolean) {
		this._useConfirmationMessage = value;
	}

	public run(): Promise<void> {
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
				let confirm = find(choices, x => x.key === choice);
				resolve(confirm && confirm.value);
			});
		});
	}

	private promptConfirmationMessage(): Promise<IConfirmationResult> {
		let confirm: IConfirmation = {
			message: nls.localize('clearRecentConnectionMessage', "Are you sure you want to delete all the connections from the list?"),
			primaryButton: nls.localize('connectionDialog.yes', "Yes"),
			secondaryButton: nls.localize('connectionDialog.no', "No"),
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

	public run(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			resolve(this._connectionManagementService.clearRecentConnection(this._connectionProfile));
			this._onRecentConnectionRemoved.fire();
		});
	}
}

/**
 * Action to retrieve the current connection string
 */
export class GetCurrentConnectionStringAction extends Action {

	public static ID = 'getCurrentConnectionStringAction';
	public static LABEL = nls.localize('connectionAction.GetCurrentConnectionString', "Get Current Connection String");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEditorService private _editorService: IEditorService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IClipboardService private _clipboardService: IClipboardService,
	) {
		super(GetCurrentConnectionStringAction.ID, GetCurrentConnectionStringAction.LABEL);
		this.enabled = true;
	}

	public run(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let activeInput = this._editorService.activeEditor;
			if (activeInput && (activeInput instanceof QueryEditorInput || activeInput instanceof EditDataInput || activeInput instanceof DashboardInput)
				&& this._connectionManagementService.isConnected(activeInput.uri)) {
				let includePassword = false;
				let connectionProfile = this._connectionManagementService.getConnectionProfile(activeInput.uri);
				this._connectionManagementService.getConnectionString(connectionProfile.id, includePassword).then(result => {

					//Copy to clipboard
					this._clipboardService.writeText(result);

					let message = result
						? result
						: nls.localize('connectionAction.connectionString', "Connection string not available");
					this._notificationService.info(message);
				});
			} else {
				let message = nls.localize('connectionAction.noConnection', "No active connection available");
				this._notificationService.info(message);
			}
		});
	}
}
