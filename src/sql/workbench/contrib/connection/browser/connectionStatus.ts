/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from 'vs/workbench/services/statusbar/browser/statusbar';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { localize } from 'vs/nls';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { ILogService } from 'vs/platform/log/common/log';


// Connection status bar showing the current global connection
export class ConnectionStatusbarItem extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.connection.status';
	private readonly name = localize('status.connection.status', "Connection Status");
	private statusItem: IStatusbarEntryAccessor;


	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IEditorService private readonly _editorService: IEditorService,
		@IObjectExplorerService private readonly _objectExplorerService: IObjectExplorerService,
    @IQueryModelService private _queryModelService: IQueryModelService,
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this.statusItem = this._register(
			this._statusbarService.addEntry({
				name: this.name,
				text: '',
				ariaLabel: ''
			},
				ConnectionStatusbarItem.ID,
				StatusbarAlignment.RIGHT, 100)
		);

		this.hide();

		this._register(this._connectionManagementService.onConnect(() => this._updateStatus()));
		this._register(this._connectionManagementService.onConnectionChanged(() => this._updateStatus()));
		this._register(this._connectionManagementService.onDisconnect(() => this._updateStatus()));
		this._register(this._editorService.onDidActiveEditorChange(() => this._updateStatus()));
		this._register(this._objectExplorerService.onSelectionOrFocusChange(() => this._updateStatus()));
    this._register(this._queryModelService.onPidAvailable(e => this._refreshPIDStatus(e.type, e.data)));
	}

	private hide() {
		this._statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, false);
	}

	private show() {
		this._statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, true);
	}

	// Update the connection status shown in the bar
	private _updateStatus(): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService, this._logService);
		if (activeConnection) {
			let uri = this._connectionManagementService.getConnectionUriFromId(activeConnection.id);
			let info = this._connectionManagementService.getConnectionInfo(uri);
			if (this._editorService.activeEditor) {
				// USE ACTIVE EDITOR INFO AS THE PID WILL BE DIFFERENT FOR EDITOR CONNECTION.
				let newInfo = this._connectionManagementService.getConnectionInfo(this._editorService.activeEditor.resource.toString());
				if (newInfo) {
					info = newInfo;
				}
			}
			if (info && info.pid) {
				this._setConnectionText(activeConnection, info.pid)
			}
			else {
				this._setConnectionText(activeConnection);
			}
			this.show();
		}
		else {
			this.hide();
		}
	}

	private _refreshPIDStatus(uri: string, pid: any): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService);
		if (activeConnection) {
			let currUri = this._connectionManagementService.getConnectionUriFromId(activeConnection.id);
			if (this._editorService.activeEditor) {
				// USE ACTIVE EDITOR INFO AS THE PID WILL BE DIFFERENT FOR EDITOR CONNECTION.
				currUri = this._editorService.activeEditor.resource.toString();
			}
			let info = this._connectionManagementService.getConnectionInfo(currUri);
			if (currUri === uri) {
				if (info) {
					info.pid = pid;
					this._setConnectionText(activeConnection, pid);
				}
			}
		}
	}

	// Set connection info to connection status bar
	private _setConnectionText(connectionProfile: IConnectionProfile, pid?: string): void {
		let text: string = connectionProfile.serverName;
		if (text) {
			if (connectionProfile.databaseName && connectionProfile.databaseName !== '') {
				text = text + ' : ' + connectionProfile.databaseName;
			} else {
				text = text + ' : ' + '<default>';
			}
		}

		let tooltip = 'Server: ' + connectionProfile.serverName + '\r\n' +
			'Database: ' + (connectionProfile.databaseName ? connectionProfile.databaseName : '<default>') + '\r\n';

		if (connectionProfile.userName && connectionProfile.userName !== '') {
			tooltip = tooltip + 'Login: ' + connectionProfile.userName + '\r\n';
		}

		if (pid) {
			text += ' (' + pid + ')';
			let processIDName = connectionProfile.serverCapabilities.processIDName;
			tooltip += (processIDName ? processIDName : 'PID') + ': ' + pid
		}

		this.statusItem.update({
			name: this.name,
			text: text,
			ariaLabel: text,
			tooltip
		});
	}
}
