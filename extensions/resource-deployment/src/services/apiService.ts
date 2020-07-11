/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from '../../../azurecore/src/azurecore';
import * as vscode from 'vscode';

export interface IApiService {
	getAzurecoreApi(): Promise<azurecore.IExtension>;
}

class ApiService implements IApiService {

	private azurecoreApi: azurecore.IExtension | undefined;

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
}

export const apiService: IApiService = new ApiService();
