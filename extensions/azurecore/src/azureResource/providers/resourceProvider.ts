/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';

export class ResourceProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _providerId: string,
		private _treeProvider: azureResource.IAzureResourceTreeDataProvider
	) { }

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return this._treeProvider;
	}

	public get providerId(): string {
		return this._providerId;
	}
}
