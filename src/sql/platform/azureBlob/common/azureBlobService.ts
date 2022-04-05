/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import type * as mssql from 'mssql';

export const SERVICE_ID = 'azureBlobService';

export const IAzureBlobService = createDecorator<IAzureBlobService>(SERVICE_ID);

export interface IAzureBlobService {
	_serviceBrand: undefined;
	/**
	* Create shared access signature for blob container
	*/
	createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Promise<mssql.CreateSasResponse>;
}
