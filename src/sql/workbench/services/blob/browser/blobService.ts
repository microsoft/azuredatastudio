/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IBlobService } from 'sql/platform/blob/common/blobService';
import { MainThreadBlob } from 'sql/workbench/api/browser/mainThreadAzureBlob';

export class BlobService implements IBlobService {

	public _serviceBrand: undefined;
	private _proxy: MainThreadBlob;

	/**
	 * Internal use only, do not call! This is called once on startup by the proxy object used
	 * to communicate with the extension host once it's been created.
	 * @param proxy The proxy to use to communicate with the azurecore extension
	 */
	public registerProxy(proxy: MainThreadBlob) {
		this._proxy = proxy;
	}

	public createSas(connectionUri: string, blobContainerUri: string, blobContainerKey: string, storageAccountName: string, expirationDate: string): Thenable<azdata.CreateSasResponse> {
		this.checkProxy();
		return this._proxy.createSas(connectionUri, blobContainerUri, blobContainerKey, storageAccountName, expirationDate);
	}

	private checkProxy(): void {
		if (!this._proxy) {
			throw new Error('Azure Blob proxy not initialized');
		}
	}
}
