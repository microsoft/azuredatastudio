/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
import * as kusto from '../kusto';
import * as Utils from '../utils';
import { ClientCapabilities } from 'vscode-languageclient';
import * as azdata from 'azdata';
import * as contracts from '../contracts';

export class SchemaCompareService implements kusto.ISchemaCompareService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SchemaCompareService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'schemaCompare')!.schemaCompare = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.SchemaCompareService, this);
	}

	public schemaCompare(operationId: string, sourceEndpointInfo: kusto.SchemaCompareEndpointInfo, targetEndpointInfo: kusto.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: kusto.DeploymentOptions): Thenable<kusto.SchemaCompareResult> {
		const params: contracts.SchemaCompareParams = { operationId: operationId, sourceEndpointInfo: sourceEndpointInfo, targetEndpointInfo: targetEndpointInfo, taskExecutionMode: taskExecutionMode, deploymentOptions: deploymentOptions };
		return this.client.sendRequest(contracts.SchemaCompareRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaCompareGenerateScript(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		const params: contracts.SchemaCompareGenerateScriptParams = { operationId: operationId, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.SchemaCompareGenerateScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareGenerateScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaComparePublishChanges(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		const params: contracts.SchemaComparePublishChangesParams = { operationId: operationId, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.SchemaComparePublishChangesRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaComparePublishChangesRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaCompareGetDefaultOptions(): Thenable<kusto.SchemaCompareOptionsResult> {
		const params: contracts.SchemaCompareGetOptionsParams = {};
		return this.client.sendRequest(contracts.SchemaCompareGetDefaultOptionsRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareGetDefaultOptionsRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaCompareIncludeExcludeNode(operationId: string, diffEntry: kusto.DiffEntry, includeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		const params: contracts.SchemaCompareNodeParams = { operationId: operationId, diffEntry, includeRequest, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.SchemaCompareIncludeExcludeNodeRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareIncludeExcludeNodeRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaCompareOpenScmp(filePath: string): Thenable<kusto.SchemaCompareOpenScmpResult> {
		const params: contracts.SchemaCompareOpenScmpParams = { filePath: filePath };
		return this.client.sendRequest(contracts.SchemaCompareOpenScmpRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareOpenScmpRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaCompareSaveScmp(sourceEndpointInfo: kusto.SchemaCompareEndpointInfo, targetEndpointInfo: kusto.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: kusto.DeploymentOptions, scmpFilePath: string, excludedSourceObjects: kusto.SchemaCompareObjectId[], excludedTargetObjects: kusto.SchemaCompareObjectId[]): Thenable<azdata.ResultStatus> {
		const params: contracts.SchemaCompareSaveScmpParams = { sourceEndpointInfo: sourceEndpointInfo, targetEndpointInfo: targetEndpointInfo, taskExecutionMode: taskExecutionMode, deploymentOptions: deploymentOptions, scmpFilePath: scmpFilePath, excludedSourceObjects: excludedSourceObjects, excludedTargetObjects: excludedTargetObjects };
		return this.client.sendRequest(contracts.SchemaCompareSaveScmpRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareSaveScmpRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public schemaCompareCancel(operationId: string): Thenable<azdata.ResultStatus> {
		const params: contracts.SchemaCompareCancelParams = { operationId: operationId };
		return this.client.sendRequest(contracts.SchemaCompareCancellationRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.SchemaCompareCancellationRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}
}
