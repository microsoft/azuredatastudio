/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import type * as mssql from 'mssql';

export const SERVICE_ID = 'azureBlobService';

export const IAzureBlobService = createDecorator<IAzureBlobService>(SERVICE_ID);

export interface IAzureBlobService {
	_serviceBrand: undefined;
	/**
		 * Create a shared access signature for the specified blob container URI and saves it to the server specified with the connectionUri
		 * @param connectionUri The connection URI of the server to save the SAS to
		 * @param blobContainerUri The blob container URI to create the SAS for
		 * @param blobStorageKey The key used to access the storage account
		 * @param storageAccountName The name of the storage account the SAS will be created for
		 * @param expirationDate The expiration date of the SAS
		 * @returns A created shared access signature token
		 */
	createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Promise<mssql.CreateSasResponse>;
}
