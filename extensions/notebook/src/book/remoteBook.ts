/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as utils from '../common/utils';
import { IAsset } from './remoteBookController';

export abstract class RemoteBook {
	public localPath: vscode.Uri;

	constructor(public readonly remotePath: vscode.Uri, public readonly outputChannel: vscode.OutputChannel, public readonly _asset?: IAsset) {
		this.remotePath = remotePath;
	}

	public abstract createLocalCopy(): Promise<void>;

	public setLocalPath(): void {
		// Save directory on User directory
		if (vscode.workspace.workspaceFolders !== undefined) {
			// Get workspace root path
			let folders = vscode.workspace.workspaceFolders;
			this.localPath = vscode.Uri.file(folders[0].uri.fsPath);
		} else {
			//If no workspace folder is opened then path is Users directory
			this.localPath = vscode.Uri.file(utils.getUserHome());
		}
	}
}
