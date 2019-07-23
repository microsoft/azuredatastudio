/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SharedService, SharedServiceProxy } from '../liveshare';

export class LiveShareDocumentState {
	public isConnected: boolean;
	public serverName: string;
	public databaseName: string;
}

export class StatusProvider {
	private _sharedService: SharedService;
	private _sharedServiceProxy: SharedServiceProxy;

	public constructor(private _isHost: boolean) { }

	public initialize(isHost: boolean, service: any) {
		if (this._isHost) {
			this._sharedService = <SharedService>service;
			this.registerStatusProvider();
		} else {
			this._sharedServiceProxy = <SharedServiceProxy>service;
		}
	}

	private registerStatusProvider(): void {
		this._sharedService.onRequest('getDocumentState', (args: any) => {
			return true;
		});
	}

	public getDocumentState(doc: vscode.TextDocument): Promise<LiveShareDocumentState> {
		if (!this._isHost) {
			let ownerUri: string = doc.uri.toString();
			return this._sharedServiceProxy.request('getDocumentState', [{
				ownerUri: ownerUri
			}]);
		} else {
			return Promise.resolve(undefined);
		}
	}
}
