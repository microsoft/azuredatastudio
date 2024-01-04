/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { IAzureBlobService } from 'sql/platform/azureBlob/common/azureBlobService';
import { MainThreadAzureBlob } from 'sql/workbench/api/browser/mainThreadAzureBlob';

export class AzureBlobService implements IAzureBlobService {

	public _serviceBrand: undefined;
	private _proxy: MainThreadAzureBlob;

	/**
	 * Internal use only, do not call! This is called once on startup by the proxy object used
	 * to communicate with the extension host once it's been created.
	 * @param proxy The proxy to use to communicate with the mssql extension
	 */
	public registerProxy(proxy: MainThreadAzureBlob) {
		this._proxy = proxy;
	}

	public createSas(connectionUri: string, blobContainerUri: string, blobContainerKey: string, storageAccountName: string, expirationDate: string): Promise<mssql.CreateSasResponse> {
		this.checkProxy();
		return Promise.resolve(this._proxy.createSas(connectionUri, blobContainerUri, blobContainerKey, storageAccountName, expirationDate));
	}

	private checkProxy(): void {
		if (!this._proxy) {
			throw new Error('Azure Blob proxy not initialized');
		}
	}
}
