/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as azdata from 'azdata';
import { IBlobService } from 'sql/platform/blob/common/blobService';
import { invalidProvider } from 'sql/base/common/errors';

export class BlobService implements IBlobService {

	public _serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.BlobProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	public createSas(connectionUri: string, blobContainerUri: string, blobContainerKey: string, storageAccountName: string, expirationDate: string): Thenable<azdata.CreateSasResponse> {
		return new Promise<azdata.CreateSasResponse>((resolve, reject) => {
			const providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.createSas(connectionUri, blobContainerUri, blobContainerKey, storageAccountName, expirationDate).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
			}
		});
	}

	private getProvider(connectionUri: string): { provider: azdata.BlobProvider, providerName: string } | undefined {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			return { provider: this._providers[providerId], providerName: providerId };
		} else {
			return undefined;
		}
	}

	/**
	 * Register a blob container provider
	 */
	public registerProvider(providerId: string, provider: azdata.BlobProvider): void {
		this._providers[providerId] = provider;
	}
}
