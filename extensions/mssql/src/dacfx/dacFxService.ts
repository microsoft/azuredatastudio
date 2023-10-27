/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as azdata from 'azdata';
import * as contracts from '../contracts';

import { AppContext } from '../appContext';
import { BaseService, ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';

export class DacFxService extends BaseService implements mssql.IDacFxService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends DacFxService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'dacfx')!.dacfx = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.DacFxService, this);
	}

	public async exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		const params: contracts.ExportParams = { databaseName: databaseName, packageFilePath: packageFilePath, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.ExportRequest.type, params);
	}

	public async importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		const params: contracts.ImportParams = { packageFilePath: packageFilePath, databaseName: databaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.ImportRequest.type, params);
	}

	public async extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.DacFxResult> {
		const params: contracts.ExtractParams = { databaseName: databaseName, packageFilePath: packageFilePath, applicationName: applicationName, applicationVersion: applicationVersion, ownerUri: ownerUri, extractTarget: mssql.ExtractTarget.dacpac, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.ExtractRequest.type, params);
	}

	public async createProjectFromDatabase(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: mssql.ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode, includePermissions?: boolean): Promise<mssql.DacFxResult> {
		const params: contracts.ExtractParams = { databaseName: databaseName, packageFilePath: targetFilePath, applicationName: applicationName, applicationVersion: applicationVersion, ownerUri: ownerUri, extractTarget: extractTarget, taskExecutionMode: taskExecutionMode, includePermissions: includePermissions };
		return this.runWithErrorHandling(contracts.ExtractRequest.type, params);
	}

	public async deployDacpac(packageFilePath: string, targetDatabaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: mssql.DeploymentOptions): Promise<mssql.DacFxResult> {
		const params: contracts.DeployParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, upgradeExisting: upgradeExisting, sqlCommandVariableValues: sqlCommandVariableValues ? Object.fromEntries(sqlCommandVariableValues) : undefined, deploymentOptions: deploymentOptions, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.DeployRequest.type, params);
	}

	public async generateDeployScript(packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: mssql.DeploymentOptions): Promise<mssql.DacFxResult> {
		const params: contracts.GenerateDeployScriptParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, sqlCommandVariableValues: sqlCommandVariableValues ? Object.fromEntries(sqlCommandVariableValues) : undefined, deploymentOptions: deploymentOptions, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.GenerateDeployScriptRequest.type, params);
	}

	public async generateDeployPlan(packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<mssql.GenerateDeployPlanResult> {
		const params: contracts.GenerateDeployPlanParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.GenerateDeployPlanRequest.type, params);
	}

	public async getOptionsFromProfile(profilePath: string): Promise<mssql.DacFxOptionsResult> {
		const params: contracts.GetOptionsFromProfileParams = { profilePath: profilePath };
		return this.runWithErrorHandling(contracts.GetOptionsFromProfileRequest.type, params);
	}

	public async validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Promise<mssql.ValidateStreamingJobResult> {
		const params: contracts.ValidateStreamingJobParams = { packageFilePath: packageFilePath, createStreamingJobTsql: createStreamingJobTsql };
		return this.runWithErrorHandling(contracts.ValidateStreamingJobRequest.type, params);
	}

	public async parseTSqlScript(filePath: string, databaseSchemaProvider: string): Promise<mssql.ParseTSqlScriptResult> {
		const params: contracts.ParseTSqlScriptParams = { filePath, databaseSchemaProvider };
		return this.runWithErrorHandling(contracts.ParseTSqlScriptRequest.type, params);
	}

	public async savePublishProfile(profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: mssql.DeploymentOptions): Promise<azdata.ResultStatus> {
		const params: contracts.SavePublishProfileParams = { profilePath, databaseName, connectionString, sqlCommandVariableValues: sqlCommandVariableValues ? Object.fromEntries(sqlCommandVariableValues) : undefined, deploymentOptions };
		return this.runWithErrorHandling(contracts.SavePublishProfileRequest.type, params);
	}
}
