/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { ConnectionProvider } from './connectionProvider';
import { QueryProvider } from './queryProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const connectionProvider = new ConnectionProvider();
	context.subscriptions.push(azdata.dataprotocol.registerConnectionProvider(connectionProvider));
	context.subscriptions.push(azdata.dataprotocol.registerQueryProvider(new QueryProvider(connectionProvider)));
}

export async function deactivate(): Promise<any> {
}
