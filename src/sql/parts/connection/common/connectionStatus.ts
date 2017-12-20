/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { $, append, show, hide } from 'vs/base/browser/dom';
import { IDisposable, combinedDisposable } from 'vs/base/common/lifecycle';
import URI from 'vs/base/common/uri';
import { IEditorInput } from 'vs/platform/editor/common/editor';
import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IConnectionManagementService, IConnectionParams } from 'sql/parts/connection/common/connectionManagement';
import { ConnectionStatusManager } from 'sql/parts/connection/common/connectionStatusManager';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';

enum ConnectionActivityStatus {
	Connected,
	Disconnected
}

// Contains connection status for each editor
class ConnectionStatusEditor {
	public connectionActivityStatus: ConnectionActivityStatus;
	public connectionProfile: IConnectionProfile;

	constructor() {
		this.connectionActivityStatus = ConnectionActivityStatus.Disconnected;
	}
}

// Connection status bar for editor
export class ConnectionStatusbarItem implements IStatusbarItem {

	private _element: HTMLElement;
	private _connectionElement: HTMLElement;
	private _connectionStatusEditors: { [connectionUri: string]: ConnectionStatusEditor };
	private _toDispose: IDisposable[];
	private _connectionStatusManager: ConnectionStatusManager;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEditorGroupService private _editorGroupService: IEditorGroupService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
	) {
		this._connectionStatusEditors = {};
		this._connectionStatusManager = new ConnectionStatusManager(this._capabilitiesService);
	}

	public render(container: HTMLElement): IDisposable {
		this._element = append(container, $('.connection-statusbar-item'));
		this._connectionElement = append(this._element, $('div.connection-statusbar-conninfo'));
		hide(this._connectionElement);

		this._toDispose = [];
		this._toDispose.push(
			this._connectionManagementService.onConnect((connectionUri: IConnectionParams) => this._onConnect(connectionUri)),
			this._connectionManagementService.onConnectionChanged((connectionUri: IConnectionParams) => this._onConnect(connectionUri)),
			this._connectionManagementService.onDisconnect((connectionUri: IConnectionParams) => this._onDisconnect(connectionUri)),
			this._editorGroupService.onEditorsChanged(() => this._onEditorsChanged()),
			this._editorGroupService.getStacksModel().onEditorClosed(event => this._onEditorClosed(event))
		);

		return combinedDisposable(this._toDispose);
	}

	private _onEditorClosed(event: IEditorCloseEvent): void {
		let uri = WorkbenchUtils.getEditorUri(event.editor);
		if (uri && uri in this._connectionStatusEditors) {
			this._updateStatus(uri, ConnectionActivityStatus.Disconnected, undefined);
			delete this._connectionStatusEditors[uri];
		}
	}

	private _onEditorsChanged(): void {
		let activeEditor = this._editorService.getActiveEditor();
		if (activeEditor) {
			let uri = WorkbenchUtils.getEditorUri(activeEditor.input);

			// Show active editor's query status
			if (uri && uri in this._connectionStatusEditors) {
				this._showStatus(uri);
			} else {
				hide(this._connectionElement);
			}
		} else {
			hide(this._connectionElement);
		}
	}

	private _onConnect(connectionParams: IConnectionParams): void {
		if (!this._connectionStatusManager.isDefaultTypeUri(connectionParams.connectionUri)) {
			this._updateStatus(connectionParams.connectionUri, ConnectionActivityStatus.Connected, connectionParams.connectionProfile);
		}
	}

	private _onDisconnect(connectionUri: IConnectionParams): void {
		if (!this._connectionStatusManager.isDefaultTypeUri(connectionUri.connectionUri)) {
			this._updateStatus(connectionUri.connectionUri, ConnectionActivityStatus.Disconnected, undefined);
		}
	}

	// Update connection status for the editor
	private _updateStatus(uri: string, newStatus: ConnectionActivityStatus, connectionProfile: IConnectionProfile) {
		if (uri) {
			if (!(uri in this._connectionStatusEditors)) {
				this._connectionStatusEditors[uri] = new ConnectionStatusEditor();
			}
			this._connectionStatusEditors[uri].connectionActivityStatus = newStatus;
			this._connectionStatusEditors[uri].connectionProfile = connectionProfile;
			this._showStatus(uri);
		}
	}

	// Show/hide query status for active editor
	private _showStatus(uri: string): void {
		let activeEditor = this._editorService.getActiveEditor();
		if (activeEditor) {
			let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
			if (uri === currentUri) {
				switch (this._connectionStatusEditors[uri].connectionActivityStatus) {
					case ConnectionActivityStatus.Connected:
						this._setConnectionText(this._connectionStatusEditors[uri].connectionProfile);
						show(this._connectionElement);
						break;
					case ConnectionActivityStatus.Disconnected:
						hide(this._connectionElement);
						break;
				}
			}
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
