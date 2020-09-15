/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import * as azdataExt from 'azdata-ext';

export interface IApiService {
	getAzurecoreApi(): Promise<azurecore.IExtension>;
	getAzdataApi(): Promise<azdataExt.IExtension>;
}

class ApiService implements IApiService {
	constructor() { }

	public async getAzurecoreApi(): Promise<azurecore.IExtension> {
		return vscode.extensions.getExtension(azurecore.extension.name)?.exports;
	}

	public async getAzdataApi(): Promise<azdataExt.IExtension> {
		return vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}
}

export const apiService: IApiService = new ApiService();
