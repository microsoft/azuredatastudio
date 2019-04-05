/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as azdata from 'azdata';

export class DacFxTestService implements azdata.DacFxServicesProvider {
	exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> {
		return undefined;
	}
	importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> {
		return undefined;
	}
	extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> {
		return undefined;
	}
	deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> {
		return undefined;
	}
	generateDeployScript(packageFilePath: string, databaseName: string, scriptFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> {
		return undefined;
	}
	generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.GenerateDeployPlanResult> {
		return undefined;
	}
	schemaCompare(sourceEndpointInfo: azdata.SchemaCompareEndpointInfo, targetEndpointInfo: azdata.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.SchemaCompareResult> {
		let result : azdata.SchemaCompareResult = {
			operationId: 'test operation id',
			areEqual: true,
			differences: [],
			success: true,
			errorMessage: ''
		};

		return Promise.resolve(result);
	}
	schemaCompareGenerateScript(operationId: string, targetDatabaseName: string, scriptFilePath: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> {
		return undefined;
	}

	handle?: number;
	readonly providerId: string = 'MSSQL';

	registerOnUpdated(handler: () => any): void {
	}
}
