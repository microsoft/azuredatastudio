/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';

export class DacFxTestService implements mssql.IDacFxService {

	testOperationId: string = 'Test Operation Id';
	dacfxResult: mssql.DacFxResult = {
		success: true,
		operationId: 'test',
		errorMessage: ''
	};
	constructor() {
	}

	exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = 'export bacpac';
		return Promise.resolve(this.dacfxResult);
	}
	importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = 'import bacpac';
		return Promise.resolve(this.dacfxResult);
	}
	extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = 'extract dacpac';
		return Promise.resolve(this.dacfxResult);
	}
	importDatabaseProject(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: mssql.ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = 'import bacpac';
		return Promise.resolve(this.dacfxResult);
	}
	deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = 'deploy dacpac';
		return Promise.resolve(this.dacfxResult);
	}
	generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>): Thenable<mssql.DacFxResult> {
		this.dacfxResult.operationId = 'generate deploy script';
		return Promise.resolve(this.dacfxResult);
	}
	generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.GenerateDeployPlanResult> {
		this.dacfxResult.operationId = 'genenrate deploy plan';
		const deployPlan: mssql.GenerateDeployPlanResult = {
			operationId: 'genenrate deploy plan',
			success: true,
			errorMessage: '',
			report: 'test deploy plan report'
		};
		return Promise.resolve(deployPlan);
	}
}
