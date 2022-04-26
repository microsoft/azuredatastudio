/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as mssql from 'mssql';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostAzureBlobShape,
	MainThreadAzureBlobShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IAzureBlobService } from 'sql/platform/azureBlob/common/azureBlobService';
import { AzureBlobService } from 'sql/workbench/services/azureBlob/browser/azureBlobService';

@extHostNamedCustomer(SqlMainContext.MainThreadAzureBlob)
export class MainThreadAzureBlob extends Disposable implements MainThreadAzureBlobShape {
	private _proxy: ExtHostAzureBlobShape;
	public _serviceBrand: undefined;

	constructor(
		extHostContext: IExtHostContext,
		@IAzureBlobService azureBlobService: IAzureBlobService
	) {
		super();
		this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostAzureBlob);
		(azureBlobService as AzureBlobService).registerProxy(this);
	}

	public createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Thenable<mssql.CreateSasResponse> {
		return this._proxy.$createSas(connectionUri, blobContainerUri, blobStorageKey, storageAccountName, expirationDate);
	}
}
