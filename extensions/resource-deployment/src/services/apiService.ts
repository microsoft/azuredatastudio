/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import * as arc from 'arc';

export interface IApiService {
	getAzurecoreApi(): Promise<azurecore.IExtension>;
	getArcApi(): Promise<arc.IExtension>;
}

class ApiService implements IApiService {

	private azurecoreApi: azurecore.IExtension | undefined;
	private arcApi: arc.IExtension | undefined;

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

	public async getArcApi(): Promise<arc.IExtension> {
		if (!this.arcApi) {
			this.arcApi = <arc.IExtension>(await vscode.extensions.getExtension(arc.extension.name)?.activate());
			if (!this.arcApi) {
				throw new Error('Unable to retrieve arc API');
			}
		}
		return this.arcApi;
	}
}

export const apiService: IApiService = new ApiService();
