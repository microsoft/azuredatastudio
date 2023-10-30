/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface IServerInstance {
	readonly port: string;
	readonly uri: vscode.Uri;
	configure(): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
}
