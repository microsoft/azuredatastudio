/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ConnectionSummary } from 'azdata';
import * as LocalizedConstants from 'sql/workbench/services/connection/browser/localizedConstants';
import { INotificationService } from 'vs/platform/notification/common/notification';

// Status when making connections from the viewlet
export class ConnectionGlobalStatus {

	private _displayTime: number = 5000; // (in ms)

	constructor(
		@INotificationService private _notificationService: INotificationService
	) {
	}

	public setStatusToConnected(connectionSummary: ConnectionSummary): void {
		if (this._notificationService) {
			let text: string;
			let connInfo: string = connectionSummary.serverName;
			if (connInfo) {
				if (connectionSummary.databaseName && connectionSummary.databaseName !== '') {
					connInfo = connInfo + ' : ' + connectionSummary.databaseName;
				} else {
					connInfo = connInfo + ' : ' + '<default>';
				}
				text = LocalizedConstants.onDidConnectMessage + ' ' + connInfo;
			}
			this._notificationService.status(text, { hideAfter: this._displayTime });
		}
	}

	public setStatusToDisconnected(fileUri: string): void {
		if (this._notificationService) {
			this._notificationService.status(LocalizedConstants.onDidDisconnectMessage, { hideAfter: this._displayTime });
		}
	}
}
