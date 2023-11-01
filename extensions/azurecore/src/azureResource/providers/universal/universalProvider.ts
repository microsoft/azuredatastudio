/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';

export class AzureResourceUniversalResourceProvider implements azureResource.IAzureUniversalResourceProvider {
	public constructor(
		private _providerId: string,
		private _treeProvider: azureResource.IAzureUniversalTreeDataProvider
	) { }

	public getTreeDataProvider(): azureResource.IAzureUniversalTreeDataProvider {
		return this._treeProvider;
	}

	public get providerId(): string {
		return this._providerId;
	}
}
