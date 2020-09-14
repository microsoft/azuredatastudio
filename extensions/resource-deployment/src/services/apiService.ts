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

	private azurecoreApi: azurecore.IExtension | undefined;
	private azdataApi: azdataExt.IExtension | undefined;

	constructor() { }

	public async getAzurecoreApi(): Promise<azurecore.IExtension> {
		if (!this.azurecoreApi) {
			this.azurecoreApi = <azurecore.IExtension>(await vscode.extensions.getExtension(azurecore.extension.name)?.activate());
			if (!this.azurecoreApi) {
				throw new Error('Unable to retrieve azurecore API');
			}
		}
		return this.azurecoreApi;
	}

	public async getAzdataApi(): Promise<azdataExt.IExtension> {
		if (!this.azdataApi) {
			this.azdataApi = <azdataExt.IExtension>(await vscode.extensions.getExtension(azdataExt.extension.name)?.activate());
			if (!this.azdataApi) {
				throw new Error('Unable to retrieve azdata API');
			}
		}
		return this.azdataApi;
	}
}

export const apiService: IApiService = new ApiService();
