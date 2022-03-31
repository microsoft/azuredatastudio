/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { AppContext } from '../appContext';
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as constants from '../constants';
import * as contracts from '../contracts';

export class AzureBlobService implements mssql.IAzureBlobService {

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.AzureBlobService, this);
	}

	public createSas(ownerUri: string, blobContainerUri: string, blobContainerKey: string, storageAccountName: string, expirationDate: string): Thenable<mssql.CreateSasResponse> {
		const params: contracts.CreateSasParams = { ownerUri, blobContainerUri, blobContainerKey, storageAccountName, expirationDate };
		return this.client.sendRequest(contracts.CreateSasRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.CreateSasRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}
}
