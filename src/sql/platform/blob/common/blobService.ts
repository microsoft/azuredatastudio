/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';

export const SERVICE_ID = 'blobService';

export const IBlobService = createDecorator<IBlobService>(SERVICE_ID);

export interface IBlobService {
	_serviceBrand: undefined;
	/**
	* Create shared access signature for blob container
	*/
	createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Thenable<azdata.CreateSasResponse>;
	/**
	* Register a blob container provider
	*/
	registerProvider(providerId: string, provider: azdata.BlobProvider): void;
}
