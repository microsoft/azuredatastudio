/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface WebviewResourceProvider {
	toWebviewResource(resource: vscode.Uri): vscode.Uri;

	readonly cspRule: string;
}