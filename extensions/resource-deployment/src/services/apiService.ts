/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import * as arc from 'arc';

export interface IApiService {
	readonly azurecoreApi: azurecore.IExtension;
	readonly arcApi: arc.IExtension;
}

class ApiService implements IApiService {
	constructor() { }
	public get azurecoreApi() { return vscode.extensions.getExtension(azurecore.extension.name)?.exports; }
	public get arcApi() { return vscode.extensions.getExtension(arc.extension.name)?.exports; }
}

export const apiService: IApiService = new ApiService();
