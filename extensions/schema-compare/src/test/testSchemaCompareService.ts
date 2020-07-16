/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';

export class SchemaCompareTestService implements mssql.ISchemaCompareService {

	testOperationId: string = 'Test Operation Id';
	testState: testStateScmp;

	constructor(state?: testStateScmp) {
		if (state) {
			this.testState = state;
		}
		else {
			this.testState = testStateScmp.SUCCESS_EQUAL;
		}
	}

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

	schemaCompareIncludeExcludeNode(operationId: string, diffEntry: mssql.DiffEntry, IncludeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.SchemaCompareIncludeExcludeResult> {
		throw new Error('Method not implemented.');
	}

	schemaCompareOpenScmp(filePath: string): Thenable<mssql.SchemaCompareOpenScmpResult> {
		throw new Error('Method not implemented.');
	}


	schemaCompareSaveScmp(sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, targetEndpointInfo: mssql.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: mssql.DeploymentOptions, scmpFilePath: string, excludedSourceObjects: mssql.SchemaCompareObjectId[], excludedTargetObjects: mssql.SchemaCompareObjectId[]): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaCompare(operationId: string, sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, targetEndpointInfo: mssql.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.SchemaCompareResult> {
		let result: mssql.SchemaCompareResult;
		if (this.testState === testStateScmp.FAILURE) {
			result = {
				operationId: this.testOperationId,
				areEqual: false,
				differences: [],
				success: false,
				errorMessage: 'Test failure'
			};
		}
		else if (this.testState === testStateScmp.SUCCESS_NOT_EQUAL) {
			result = {
				operationId: this.testOperationId,
				areEqual: false,
				differences: [{
					updateAction: 2,
					differenceType: 0,
					name: 'SqlTable',
					sourceValue: ['dbo', 'table1'],
					targetValue: null,
					parent: null,
					children: [{
						updateAction: 2,
						differenceType: 0,
						name: 'SqlSimpleColumn',
						sourceValue: ['dbo', 'table1', 'id'],
						targetValue: null,
						parent: null,
						children: [],
						sourceScript: '',
						targetScript: null,
						included: false
					}],
					sourceScript: 'CREATE TABLE [dbo].[table1](id int)',
					targetScript: null,
					included: true
				}],
				success: true,
				errorMessage: ''
			};
		}
		else {
			result = {
				operationId: this.testOperationId,
				areEqual: true,
				differences: [],
				success: true,
				errorMessage: null
			};
		}

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

export enum testStateScmp {
	SUCCESS_EQUAL,
	SUCCESS_NOT_EQUAL,
	FAILURE
}
