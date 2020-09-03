/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { RemoteBook } from '../book/remoteBook';
import * as vscode from 'vscode';


export class SharedRemoteBook extends RemoteBook {
	constructor(public remotePath: vscode.Uri, public outputChannel: vscode.OutputChannel) {
		super(remotePath, outputChannel);
	}
	public async createLocalCopy(): Promise<void> {
		throw new Error('Not yet supported');
	}
}
