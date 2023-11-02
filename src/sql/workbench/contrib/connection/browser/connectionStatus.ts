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
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';


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
		this._register(this._queryModelService.onConnectionIdUpdated(e => this._updateUriForInfo(e.uri, e.connId)));
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
		let editorNewInfo = this.getCurrentActiveEditorInfo();
		// retrieve the currently focused editor so we can get the correct SPID value from it.
		if (editorNewInfo) {
			// active editor info is needed as uri for editor is treated as a separate process on the server.
			// make sure the active editor has the same connection as the current global connection, otherwise the user has selected an unrelated connection in OE.
			if (editorNewInfo && editorNewInfo?.connectionProfile?.id === activeConnection?.id) {
				id = editorNewInfo?.serverConnectionId;
			}
		}
		if (activeConnection) {
			this._setConnectionText(activeConnection, id)
			this.show();
		}
		else {
			this.hide();
		}
	}

	// If the connection server id for URI changes, we need to update the info for the URI with the new one
	// If the current editor is the one being updated, we will do a refresh if the id is different.
	private _updateUriForInfo(uriToUpdate: string, idForUpdate: string) {
		let newInfo = this._connectionManagementService.getConnectionInfo(uriToUpdate);
		let isDifferent = false;
		if (newInfo && newInfo.serverConnectionId !== idForUpdate) {
			isDifferent = true;
			newInfo.serverConnectionId = idForUpdate;
		}
		let activeInfo = this.getCurrentActiveEditorInfo()
		if (activeInfo && activeInfo.ownerUri === newInfo.ownerUri && isDifferent) {
			this._updateStatus();
		}
	}

	// Helper function for getting the connection info of the current editor.
	private getCurrentActiveEditorInfo(): ConnectionManagementInfo | undefined {
		if (this._editorService.activeEditor) {
			return this._connectionManagementService.getConnectionInfo(this._editorService.activeEditor.resource.toString());
		}
		return undefined;
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

		let tooltip = localize('status.connection.baseTooltip', 'Server: {0}\nDatabase: {1}\n', connectionProfile.serverName,
			(connectionProfile.databaseName ? connectionProfile.databaseName : '<default>'));

		if (connectionProfile.userName && connectionProfile.userName !== '') {
			tooltip = tooltip + localize('status.connection.tooltipLogin', 'Login: {0}\n', connectionProfile.userName);
		}

		if (id) {
			text += ' (' + id + ')';
			const serverConnectionIdName = connectionProfile.serverCapabilities.serverConnectionIdName || 'PID';
			tooltip += serverConnectionIdName + ': ' + id;
		}

		this.statusItem.update({
			name: this.name,
			text: text,
			ariaLabel: text,
			tooltip
		});
	}
}
