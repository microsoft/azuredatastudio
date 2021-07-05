/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { getExtensionApi } from './api';
import { ArcControllerConfigProfilesOptionsSource } from './providers/arcControllerConfigProfilesOptionsSource';
import { AzdataToolService } from './services/azdataToolService';

export async function activate(context: vscode.ExtensionContext): Promise<azdataExt.IExtension> {
	const azdataToolService = new AzdataToolService();
	const azdataApi = getExtensionApi(azdataToolService);

	// register option source(s)
	const rdApi = <rd.IExtension>vscode.extensions.getExtension(rd.extension.name)?.exports;
	context.subscriptions.push(rdApi.registerOptionsSourceProvider(new ArcControllerConfigProfilesOptionsSource(azdataApi)));

	return azdataApi;
}

export function deactivate(): void { }
