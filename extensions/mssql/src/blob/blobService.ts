/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { AppContext } from '../appContext';
import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as contracts from '../contracts';

export class AzureBlobService implements mssql.IAzureBlobService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends AzureBlobService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'blob')!.blob = true;
			}

			initialize(): void {
			}
		};
	}

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
