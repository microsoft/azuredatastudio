/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as mssql from 'mssql';
import * as contracts from '../contracts';
import { BaseService, SqlOpsDataClient } from 'dataprotocol-client';

export class AzureBlobService extends BaseService implements mssql.IAzureBlobService {

	public constructor(client: SqlOpsDataClient) {
		super(client);
	}

	public async createSas(ownerUri: string, blobContainerUri: string, blobContainerKey: string, storageAccountName: string, expirationDate: string): Promise<mssql.CreateSasResponse> {
		// This isn't registered as a feature since it's not something that we expect every tools client to implement currently since the usage is
		// specifically for ADS and SqlToolsService.
		const params: contracts.CreateSasParams = { ownerUri, blobContainerUri, blobContainerKey, storageAccountName, expirationDate };
		return this.runWithErrorHandling(contracts.CreateSasRequest.type, params);
	}
}
