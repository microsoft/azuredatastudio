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
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from 'vs/workbench/services/statusbar/common/statusbar';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { localize } from 'vs/nls';

// Connection status bar showing the current global connection
export class ConnectionStatusbarItem extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.connection.status';

	private statusItem: IStatusbarEntryAccessor;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IEditorService private readonly editorService: IEditorService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
	) {
		super();
		this.statusItem = this._register(
			this.statusbarService.addEntry({
				text: '',
				ariaLabel: ''
			},
				ConnectionStatusbarItem.ID,
				localize('status.connection.status', "Connection Status"),
				StatusbarAlignment.RIGHT, 100)
		);

		this.hide();

		this._register(this.connectionManagementService.onConnect(() => this._updateStatus()));
		this._register(this.connectionManagementService.onConnectionChanged(() => this._updateStatus()));
		this._register(this.connectionManagementService.onDisconnect(() => this._updateStatus()));
		this._register(this.editorService.onDidActiveEditorChange(() => this._updateStatus()));
		this._register(this.objectExplorerService.onSelectionOrFocusChange(() => this._updateStatus()));
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
			this._setConnectionText(activeConnection);
			this.show();
		} else {
			this.hide();
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

		let tooltip: string =
			'Server: ' + connectionProfile.serverName + '\r\n' +
			'Database: ' + (connectionProfile.databaseName ? connectionProfile.databaseName : '<default>') + '\r\n';

		if (connectionProfile.userName && connectionProfile.userName !== '') {
			tooltip = tooltip + 'Login: ' + connectionProfile.userName + '\r\n';
		}

		this.statusItem.update({
			text, ariaLabel: text, tooltip
		});
	}
}
