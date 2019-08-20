/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';

export class SchemaCompareTestService implements mssql.ISchemaCompareService {

	testOperationId: string = 'Test Operation Id';

	schemaComparePublishChanges(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaCompareGetDefaultOptions(): Thenable<mssql.SchemaCompareOptionsResult> {
		let result: mssql.SchemaCompareOptionsResult = {
			defaultDeploymentOptions: undefined,
			success: true,
			errorMessage: ''
		};

		return Promise.resolve(result);
	}

	schemaCompareIncludeExcludeNode(operationId: string, diffEntry: mssql.DiffEntry, IncludeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaCompareOpenScmp(filePath: string): Thenable<mssql.SchemaCompareOpenScmpResult> {
		throw new Error('Method not implemented.');
	}


	schemaCompareSaveScmp(sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, targetEndpointInfo: mssql.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: mssql.DeploymentOptions, scmpFilePath: string, excludedSourceObjects: mssql.SchemaCompareObjectId[], excludedTargetObjects: mssql.SchemaCompareObjectId[]): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaCompare(operationId: string, sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, targetEndpointInfo: mssql.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.SchemaCompareResult> {
		let result: mssql.SchemaCompareResult = {
			operationId: this.testOperationId,
			areEqual: true,
			differences: [],
			success: true,
			errorMessage: ''
		};

		return Promise.resolve(result);
	}

	schemaCompareGenerateScript(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	schemaCompareCancel(operationId: string): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	handle?: number;
	readonly providerId: string = 'MSSQL';

	registerOnUpdated(handler: () => any): void {
	}
}
