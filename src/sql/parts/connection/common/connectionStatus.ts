/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { $, append, show, hide } from 'vs/base/browser/dom';
import { IDisposable, combinedDisposable } from 'vs/base/common/lifecycle';
import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';

// Connection status bar showing the current global connection
export class ConnectionStatusbarItem implements IStatusbarItem {

	private _element: HTMLElement;
	private _connectionElement: HTMLElement;
	private _toDispose: IDisposable[];

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEditorService private _editorService: EditorServiceImpl,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
	) {
	}

	public render(container: HTMLElement): IDisposable {
		this._element = append(container, $('.connection-statusbar-item'));
		this._connectionElement = append(this._element, $('div.connection-statusbar-conninfo'));
		hide(this._connectionElement);

		this._toDispose = [];
		this._toDispose.push(
			this._connectionManagementService.onConnect(() => this._updateStatus()),
			this._connectionManagementService.onConnectionChanged(() => this._updateStatus()),
			this._connectionManagementService.onDisconnect(() => this._updateStatus()),
			this._editorService.onDidVisibleEditorsChange(() => this._updateStatus()),
			this._editorService.onDidCloseEditor(() => this._updateStatus()),
			this._objectExplorerService.onSelectionOrFocusChange(() => this._updateStatus())
		);

		return combinedDisposable(this._toDispose);
	}

	// Update the connection status shown in the bar
	private _updateStatus(): void {
		let activeConnection = TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService);
		if (activeConnection) {
			this._setConnectionText(activeConnection);
			show(this._connectionElement);
		} else {
			hide(this._connectionElement);
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

		this._connectionElement.textContent = text;
		this._connectionElement.title = tooltip;
	}
}
