/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as mssql from 'mssql';
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as contracts from '../contracts';

export class AzureBlobService implements mssql.IAzureBlobService {

	public constructor(protected readonly client: SqlOpsDataClient) { }

	public async createSas(ownerUri: string, blobContainerUri: string, blobContainerKey: string, storageAccountName: string, expirationDate: string): Promise<mssql.CreateSasResponse> {
		// This isn't registered as a feature since it's not something that we expect every tools client to implement currently since the usage is
		// specifically for ADS and SqlToolsService.
		const params: contracts.CreateSasParams = { ownerUri, blobContainerUri, blobContainerKey, storageAccountName, expirationDate };
		return this.client.sendRequest(contracts.CreateSasRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.CreateSasRequest.type, e);
				return Promise.reject(e);
			}
		);
	}
}
