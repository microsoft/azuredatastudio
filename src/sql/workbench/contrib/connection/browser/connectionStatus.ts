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

// Connection status bar showing the current global connection
export class ConnectionStatusbarItem extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.connection.status';

	private statusItem: IStatusbarEntryAccessor;
	private readonly name = localize('status.connection.status', "Connection Status");


	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IEditorService private readonly editorService: IEditorService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
		@IQueryModelService private queryModelService: IQueryModelService,
	) {
		super();
		this.statusItem = this._register(
			this.statusbarService.addEntry({
				name: this.name,
				text: '',
				ariaLabel: ''
			},
				ConnectionStatusbarItem.ID,
				StatusbarAlignment.RIGHT, 100)
		);

		this.hide();

		this._register(this.connectionManagementService.onConnect(() => { this._updateStatus(); }));
		this._register(this.connectionManagementService.onConnectionChanged(() => { this._updateStatus(); }));
		this._register(this.connectionManagementService.onDisconnect(() => { this._updateStatus(); }));
		this._register(this.editorService.onDidActiveEditorChange(() => { this._updateStatus(); }));
		this._register(this.objectExplorerService.onSelectionOrFocusChange(() => { this._updateStatus(); }));
		this._register(this.queryModelService.onPidAvailable(e => this._refreshPIDStatus(e.type, e.data)));
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, true);
	}

	// Update the connection status shown in the bar
	private _updateStatus(): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.editorService);
		if (activeConnection) {
			let uri = this.connectionManagementService.getConnectionUriFromId(activeConnection.id);
			let info = this.connectionManagementService.getConnectionInfo(uri);
			if (this.editorService.activeEditor) {
				// USE ACTIVE EDITOR INFO AS THE PID WILL BE DIFFERENT FOR EDITOR CONNECTION.
				let newInfo = this.connectionManagementService.getConnectionInfo(this.editorService.activeEditor.resource.toString());
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
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.editorService);
		if (activeConnection) {
			let currUri = this.connectionManagementService.getConnectionUriFromId(activeConnection.id);
			if (this.editorService.activeEditor) {
				// USE ACTIVE EDITOR INFO AS THE PID WILL BE DIFFERENT FOR EDITOR CONNECTION.
				currUri = this.editorService.activeEditor.resource.toString();
			}
			let info = this.connectionManagementService.getConnectionInfo(currUri);
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
