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

// Connection status bar showing the current global connection
export class ConnectionStatusbarItem extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.connection.status';
	private static readonly SPIDID = 'status.connection.spid';

	private statusItem: IStatusbarEntryAccessor;
	private SPIDStatusItem: IStatusbarEntryAccessor;
	private readonly name = localize('status.connection.status', "Connection Status");
	private readonly SPIDname = localize('status.connection.spid', "Connection SPID");


	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IEditorService private readonly editorService: IEditorService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
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

		this.SPIDStatusItem = this._register(
			this.statusbarService.addEntry({
				name: this.SPIDname,
				text: '',
				ariaLabel: ''
			},
				ConnectionStatusbarItem.SPIDID,
				StatusbarAlignment.RIGHT, 100)
		);

		this.hide();

		this._register(this.connectionManagementService.onConnect(() => { this._updateSPIDStatus(); this._updateStatus(); }));
		this._register(this.connectionManagementService.onConnectionChanged(() => { this._updateSPIDStatus(); this._updateStatus(); }));
		this._register(this.connectionManagementService.onDisconnect(() => { this._updateSPIDStatus(); this._updateStatus(); }));
		this._register(this.editorService.onDidActiveEditorChange(() => { this._updateSPIDStatus(); this._updateStatus(); }));
		this._register(this.objectExplorerService.onSelectionOrFocusChange(() => { this._updateSPIDStatus(); this._updateStatus(); }));
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, false);
		this.statusbarService.updateEntryVisibility(ConnectionStatusbarItem.SPIDID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(ConnectionStatusbarItem.ID, true);
		this.statusbarService.updateEntryVisibility(ConnectionStatusbarItem.SPIDID, true);
	}

	// Update the connection status shown in the bar
	private _updateStatus(): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.editorService);
		if (activeConnection) {
			this._setConnectionText(activeConnection);
			this.show();
		} else {
			this.hide();
		}
	}

	private _updateSPIDStatus(): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.editorService);
		if (activeConnection) {
			let uri = this.connectionManagementService.getConnectionUriFromId(activeConnection.id);
			let info = this.connectionManagementService.getConnectionInfo(uri);
			if (this.editorService.activeEditor) {
				// USE ACTIVE EDITOR INFO AS THE SPID WILL BE DIFFERENT FOR EDITOR CONNECTION.
				let newInfo = this.connectionManagementService.getConnectionInfo(this.editorService.activeEditor.resource.toString());
				if (newInfo) {
					info = newInfo;
				}
			}
			let text = '(' + info.spid + ')'
			let tooltip = 'SPID: ' + info.spid;
			this.SPIDStatusItem.update({
				name: this.SPIDname,
				text: text,
				ariaLabel: text, tooltip
			});
		}
	}

	// Set connection info to connection status bar
	private _setConnectionText(connectionProfile: IConnectionProfile): void {
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

		this.statusItem.update({
			name: this.name,
			text: text,
			ariaLabel: text, tooltip
		});
	}
}
