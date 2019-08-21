/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../mssql';
import { AppContext } from '../appContext';
import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as azdata from 'azdata';
import * as contracts from '../contracts';

export class DacFxService implements mssql.IDacFxService {
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

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.DacFxService, this);
	}

	public exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		const params: contracts.ExportParams = { databaseName: databaseName, packageFilePath: packageFilePath, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.ExportRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.ExportRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		const params: contracts.ImportParams = { packageFilePath: packageFilePath, databaseName: databaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.ImportRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.ImportRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		const params: contracts.ExtractParams = { databaseName: databaseName, packageFilePath: packageFilePath, applicationName: applicationName, applicationVersion: applicationVersion, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.ExtractRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.ExtractRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public deployDacpac(packageFilePath: string, targetDatabaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		const params: contracts.DeployParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, upgradeExisting: upgradeExisting, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.DeployRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DeployRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public generateDeployScript(packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		const params: contracts.GenerateDeployScriptParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.GenerateDeployScriptRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.GenerateDeployScriptRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	public generateDeployPlan(packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.GenerateDeployPlanResult> {
		const params: contracts.GenerateDeployPlanParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
		return this.client.sendRequest(contracts.GenerateDeployPlanRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.GenerateDeployPlanRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}
}
