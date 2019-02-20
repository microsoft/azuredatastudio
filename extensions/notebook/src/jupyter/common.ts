/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

export interface IServerInstance {
	readonly port: string;
	readonly uri: vscode.Uri;
	configure(): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
}
