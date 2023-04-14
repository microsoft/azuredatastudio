/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
import * as mssql from 'mssql';
import * as Utils from '../utils';
import { ClientCapabilities } from 'vscode-languageclient';
import * as azdata from 'azdata';
import * as contracts from '../contracts';
import { BaseService } from '../baseService';

export class SchemaCompareService extends BaseService implements mssql.ISchemaCompareService {
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

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.SchemaCompareService, this);
	}

	public schemaCompare(operationId: string, sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, targetEndpointInfo: mssql.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: mssql.DeploymentOptions): Promise<mssql.SchemaCompareResult> {
		const params: contracts.SchemaCompareParams = { operationId: operationId, sourceEndpointInfo: sourceEndpointInfo, targetEndpointInfo: targetEndpointInfo, taskExecutionMode: taskExecutionMode, deploymentOptions: deploymentOptions };
		return this.runWithErrorHandling(contracts.SchemaCompareRequest.type, params);
	}

	public schemaCompareGenerateScript(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus> {
		const params: contracts.SchemaCompareGenerateScriptParams = { operationId: operationId, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.SchemaCompareGenerateScriptRequest.type, params);
	}

	public schemaComparePublishDatabaseChanges(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus> {
		const params: contracts.SchemaComparePublishDatabaseChangesParams = { operationId: operationId, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.SchemaComparePublishDatabaseChangesRequest.type, params);
	}

	public schemaComparePublishProjectChanges(operationId: string, targetProjectPath: string, targetFolderStructure: mssql.ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.SchemaComparePublishProjectResult> {
		const params: contracts.SchemaComparePublishProjectChangesParams = { operationId: operationId, targetProjectPath: targetProjectPath, targetFolderStructure: targetFolderStructure, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.SchemaComparePublishProjectChangesRequest.type, params);
	}

	public schemaCompareGetDefaultOptions(): Promise<mssql.SchemaCompareOptionsResult> {
		const params: contracts.SchemaCompareGetOptionsParams = {};
		return this.runWithErrorHandling(contracts.SchemaCompareGetDefaultOptionsRequest.type, params);
	}

	public schemaCompareIncludeExcludeNode(operationId: string, diffEntry: mssql.DiffEntry, includeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.SchemaCompareIncludeExcludeResult> {
		const params: contracts.SchemaCompareNodeParams = { operationId: operationId, diffEntry, includeRequest, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.SchemaCompareIncludeExcludeNodeRequest.type, params);
	}

	public schemaCompareOpenScmp(filePath: string): Promise<mssql.SchemaCompareOpenScmpResult> {
		const params: contracts.SchemaCompareOpenScmpParams = { filePath: filePath };
		return this.runWithErrorHandling(contracts.SchemaCompareOpenScmpRequest.type, params);
	}

	public schemaCompareSaveScmp(sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, targetEndpointInfo: mssql.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: mssql.DeploymentOptions, scmpFilePath: string, excludedSourceObjects: mssql.SchemaCompareObjectId[], excludedTargetObjects: mssql.SchemaCompareObjectId[]): Promise<azdata.ResultStatus> {
		const params: contracts.SchemaCompareSaveScmpParams = { sourceEndpointInfo: sourceEndpointInfo, targetEndpointInfo: targetEndpointInfo, taskExecutionMode: taskExecutionMode, deploymentOptions: deploymentOptions, scmpFilePath: scmpFilePath, excludedSourceObjects: excludedSourceObjects, excludedTargetObjects: excludedTargetObjects };
		return this.runWithErrorHandling(contracts.SchemaCompareSaveScmpRequest.type, params);
	}

	public schemaCompareCancel(operationId: string): Promise<azdata.ResultStatus> {
		const params: contracts.SchemaCompareCancelParams = { operationId: operationId };
		return this.runWithErrorHandling(contracts.SchemaCompareCancellationRequest.type, params);
	}
}
