/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { getExtensionApi } from './api';
import { findAz } from './az';
import { ArcControllerConfigProfilesOptionsSource } from './providers/arcControllerConfigProfilesOptionsSource';
import { AzToolService } from './services/azToolService';

export async function activate(context: vscode.ExtensionContext): Promise<azExt.IExtension> {
	const azToolService = new AzToolService();

	azToolService.localAz = await findAz();

	const azApi = getExtensionApi(azToolService);

	// register option source(s)
	const rdApi = <rd.IExtension>vscode.extensions.getExtension(rd.extension.name)?.exports;
	context.subscriptions.push(rdApi.registerOptionsSourceProvider(new ArcControllerConfigProfilesOptionsSource(azApi)));

	return azApi;
}

export function deactivate(): void { }
