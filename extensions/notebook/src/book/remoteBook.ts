/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as loc from '../common/localizedConstants';
import * as vscode from 'vscode';
import * as utils from '../common/utils';
import { IAsset } from './remoteBookController';

export abstract class RemoteBook {
	protected _localPath: URL;
	protected outputChannel: vscode.OutputChannel;

	constructor(public remotePath: URL, protected _asset?: IAsset) {
		this.remotePath = remotePath;
		this.outputChannel = vscode.window.createOutputChannel(loc.msgTaskName);
	}

	public async abstract createLocalCopy(): Promise<void>;

	public setLocalPath(): void {
		// Save directory on User directory
		if (vscode.workspace.workspaceFolders !== undefined) {
			// Get workspace root path
			let folders = vscode.workspace.workspaceFolders;
			this._localPath = new URL(folders[0].uri.fsPath);
		} else {
			//If no workspace folder is opened then path is Users directory
			this._localPath = new URL(utils.getUserHome());
		}
	}
}
