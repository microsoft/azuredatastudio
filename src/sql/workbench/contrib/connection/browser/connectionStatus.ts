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

/**
 * Handles showing the status bar item for the current global connection
 */
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
		this._register(this._queryModelService.onConnectionIdUpdated(e => this._refreshServerConnIdForQuery(e.uri, e.connId)));
	}

	private hide() {
		this._statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, false);
	}

	private show() {
		this._statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, true);
	}

	/**
	 * Update the connection status shown in the bar
	 */
	private _updateStatus(): void {
		let activeConnection: IConnectionProfile = TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService, this._logService);
		let connectionId: string = undefined;
		// retrieve the currently focused editor so we can get the correct connection id value for it.
		let activeEditorInfo: ConnectionManagementInfo = this.getCurrentActiveEditorInfo();
		if (activeConnection) {
			// We only want to display the connection ID for editor connections, so first check to make
			// sure the connection we're displaying information for (which may be from OE or other
			// sources) matches the current active editor before updating the ID
			if (activeEditorInfo && activeEditorInfo.connectionProfile.id === activeConnection.id) {
				connectionId = activeEditorInfo.serverConnectionId;
			}
			this._setConnectionText(activeConnection, connectionId)
			this.show();
		}
		else {
			this.hide();
		}
	}

	/**
	 * Updates the server connection id after a query has been run, since the id may be changed on the server after a restart.
	 * If the current editor is the one being updated, we will do a refresh if the id is different.
	 */
	private _refreshServerConnIdForQuery(uriToUpdate: string, idForUpdate: string) {
		let isDifferent: boolean = this._connectionManagementService.updateServerConnectionId(uriToUpdate, idForUpdate);
		if (isDifferent) {
			let newInfo: ConnectionManagementInfo = this._connectionManagementService.getConnectionInfo(uriToUpdate);
			let activeInfo = this.getCurrentActiveEditorInfo();
			if (activeInfo && activeInfo.ownerUri === newInfo.ownerUri && isDifferent) {
				this._updateStatus();
			}
		}
	}

	/**
	 * Helper function for getting the connection info of the current editor.
	 */
	private getCurrentActiveEditorInfo(): ConnectionManagementInfo | undefined {
		if (this._editorService?.activeEditor?.resource) {
			return this._connectionManagementService.getConnectionInfo(this._editorService.activeEditor.resource.toString());
		}
		return undefined;
	}

	/**
	 * Set connection info to connection status bar
	 */
	private _setConnectionText(connectionProfile: IConnectionProfile, id?: string): void {
		let text: string = connectionProfile.serverName;
		if (text) {
			if (connectionProfile.databaseName && connectionProfile.databaseName !== '') {
				text = text + ' : ' + connectionProfile.databaseName;
			} else {
				text = text + ' : ' + '<default>';
			}
		}

		let tooltip = localize('status.connection.baseTooltip', 'Server: {0}\nDatabase: {1}', connectionProfile.serverName,
			(connectionProfile.databaseName ? connectionProfile.databaseName : '<default>'));

		if (connectionProfile.userName && connectionProfile.userName !== '') {
			tooltip += '\n' + localize('status.connection.tooltipLogin', 'Login: {0}', connectionProfile.userName);
		}

		if (id) {
			text += ' (' + id + ')';
			const serverConnectionIdName = connectionProfile.serverCapabilities.serverConnectionIdName || 'PID';
			tooltip += '\n' + serverConnectionIdName + ': ' + id;
		}

		this.statusItem.update({
			name: this.name,
			text: text,
			ariaLabel: text,
			tooltip
		});
	}
}
