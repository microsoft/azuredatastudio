/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
import * as mssql from '../mssql';
import * as Utils from '../utils';
import { ClientCapabilities } from 'vscode-languageclient';
import * as contracts from '../contracts';

export class ModelManagementService implements mssql.IModelManagementService {

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ModelManagementService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'languageExtension')!.languageExtension = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.ModelManagementService, this);
	}

	public getModels(ownerUri: string, table: mssql.ModelTable): Thenable<mssql.ModelMetadata[]> {
		const params: contracts.ModelManagementRequestParam = Object.assign({}, { ownerUri: ownerUri }, table);
		return this.client.sendRequest(contracts.ModelManagementGetRequest.type, params).then(
			r => {
				return r.models;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementGetRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public configureModelTable(ownerUri: string, table: mssql.ModelTable): Thenable<void> {
		const params: contracts.ModelManagementRequestParam = Object.assign({}, { ownerUri: ownerUri }, table);
		return this.client.sendRequest(contracts.ModelManagementConfigureModelTableRequest.type, params).then(
			r => {
				return;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementConfigureModelTableRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public verifyModelTable(ownerUri: string, table: mssql.ModelTable): Thenable<boolean> {
		const params: contracts.ModelManagementRequestParam = Object.assign({}, { ownerUri: ownerUri }, table);
		return this.client.sendRequest(contracts.ModelManagementVerifyModelTableRequest.type, params).then(
			r => {
				return r.verified;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementConfigureModelTableRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public deleteModel(ownerUri: string, table: mssql.ModelTable, modelId: number): Thenable<void> {
		const params: contracts.ModelManagementDeleteRequestParam = Object.assign({}, { ownerUri: ownerUri }, table, { modelId: modelId });
		return this.client.sendRequest(contracts.ModelManagementDeleteRequest.type, params).then(
			r => {
				return;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementDeleteRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public downloadModel(ownerUri: string, table: mssql.ModelTable, modelId: number): Thenable<string> {
		const params: contracts.ModelManagementDeleteRequestParam = Object.assign({}, { ownerUri: ownerUri }, table, { modelId: modelId });
		return this.client.sendRequest(contracts.ModelManagementDownloadRequest.type, params).then(
			r => {
				return r.filePath;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementDownloadRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public importModel(ownerUri: string, table: mssql.ModelTable, model: mssql.ModelMetadata): Thenable<void> {
		const params: contracts.ModelManagementImportRequestParam = Object.assign({}, { ownerUri: ownerUri }, table, { model: model });
		return this.client.sendRequest(contracts.ModelManagementImportRequest.type, params).then(
			r => {
				return;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementImportRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public updateModel(ownerUri: string, table: mssql.ModelTable, model: mssql.ModelMetadata): Thenable<void> {
		const params: contracts.ModelManagementImportRequestParam = Object.assign({}, { ownerUri: ownerUri }, table, { model: model });
		return this.client.sendRequest(contracts.ModelManagementUpdateRequest.type, params).then(
			r => {
				return;
			},
			e => {
				this.client.logFailedRequest(contracts.ModelManagementUpdateRequest.type, e);
				return Promise.reject(e);
			}
		);
	}
}
