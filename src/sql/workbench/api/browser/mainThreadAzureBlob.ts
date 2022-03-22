/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostAzureBlobShape,
	MainThreadAzureBlobShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IBlobService } from 'sql/platform/blob/common/blobService';
import { BlobService } from 'sql/workbench/services/blob/browser/blobService';

@extHostNamedCustomer(SqlMainContext.MainThreadAzureBlob)
export class MainThreadBlob extends Disposable implements MainThreadAzureBlobShape {
	private _proxy: ExtHostAzureBlobShape;
	public _serviceBrand: undefined;

	constructor(
		extHostContext: IExtHostContext,
		@IBlobService azureAccountService: IBlobService
	) {
		super();
		this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostAzureBlob);
		(azureAccountService as BlobService).registerProxy(this);
	}

	public createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Thenable<azdata.CreateSasResponse> {
		return this._proxy.$createSas(connectionUri, blobContainerUri, blobStorageKey, storageAccountName, expirationDate);
	}
}
