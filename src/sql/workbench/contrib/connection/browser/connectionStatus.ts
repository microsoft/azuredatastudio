/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
		this._register(this._queryModelService.onConnIdAvailable(e => this._refreshIDStatus(e.uri, e.connId)));
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
		let id = undefined;
		if (this._editorService.activeEditor) {
			// USE ACTIVE EDITOR INFO AS THE ID WILL BE DIFFERENT FOR EDITOR CONNECTION.
			let newInfo = this._connectionManagementService.getConnectionInfo(this._editorService.activeEditor.resource.toString());
			id = newInfo?.serverConnectionId;
		}
		if (activeConnection) {
			this._setConnectionText(activeConnection, id)
			this.show();
		}
		else {
			this.hide();
		}
	}

	private _refreshIDStatus(uri: string, id: string | undefined): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService, this._logService);
		if (this._editorService.activeEditor) {
			// USE ACTIVE EDITOR INFO AS THE ID WILL BE DIFFERENT FOR EDITOR CONNECTION.
			let currUri = this._editorService.activeEditor.resource.toString();
			let info = this._connectionManagementService.getConnectionInfo(currUri);
			if (currUri === uri) {
				if (info) {
					info.serverConnectionId = id;
					this._setConnectionText(activeConnection, id);
				}
			}
		}
	}

	// Set connection info to connection status bar
	private _setConnectionText(connectionProfile: IConnectionProfile, id?: string): void {
		let text: string = connectionProfile.serverName;
		if (text) {
			if (connectionProfile.databaseName && connectionProfile.databaseName !== '') {
				text = text + ' : ' + connectionProfile.databaseName;
			} else {
				text = text + ' : ' + '<default>';
			}
		}

		let tooltip = localize('status.connection.baseTooltip', 'Server: {0}\r\nDatabase: {1}\r\n', connectionProfile.serverName,
			(connectionProfile.databaseName ? connectionProfile.databaseName : '<default>'));

		if (connectionProfile.userName && connectionProfile.userName !== '') {
			tooltip = tooltip + localize('status.connection.tooltipLogin', 'Login: {0}\r\n', connectionProfile.userName);
		}

		if (id) {
			text += ' (' + id + ')';
			const serverConnectionIDName = connectionProfile.serverCapabilities.serverConnectionIDName || 'PID';
			tooltip += serverConnectionIDName + ': ' + id;
		}

		this.statusItem.update({
			name: this.name,
			text: text,
			ariaLabel: text,
			tooltip
		});
	}
}
