/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';

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

	schemaComparePublishDatabaseChanges(_operationId: string, _targetServerName: string, _targetDatabaseName: string, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaComparePublishProjectChanges(_operationId: string, _targetProjectPath: string, _targetFolderStructure: mssql.ExtractTarget, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.SchemaComparePublishProjectResult> {
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

	schemaCompareIncludeExcludeNode(_operationId: string, _diffEntry: mssql.DiffEntry, _IncludeRequest: boolean, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.SchemaCompareIncludeExcludeResult> {
		throw new Error('Method not implemented.');
	}

	schemaCompareOpenScmp(_filePath: string): Thenable<mssql.SchemaCompareOpenScmpResult> {
		throw new Error('Method not implemented.');
	}

	schemaCompareSaveScmp(_sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, _targetEndpointInfo: mssql.SchemaCompareEndpointInfo, _taskExecutionMode: azdata.TaskExecutionMode, _deploymentOptions: mssql.DeploymentOptions, _scmpFilePath: string, _excludedSourceObjects: mssql.SchemaCompareObjectId[], _excludedTargetObjects: mssql.SchemaCompareObjectId[]): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaCompare(_operationId: string, _sourceEndpointInfo: mssql.SchemaCompareEndpointInfo, _targetEndpointInfo: mssql.SchemaCompareEndpointInfo, _taskExecutionMode: azdata.TaskExecutionMode, _deploymentOptions: mssql.DeploymentOptions): Thenable<mssql.SchemaCompareResult> {
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

	schemaCompareGenerateScript(_operationId: string, _targetServerName: string, _targetDatabaseName: string, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		let result: azdata.ResultStatus;
		if (this.testState === testStateScmp.FAILURE) {
			result = {
				success: false,
				errorMessage: 'Test failure'
			};
		}
		else {
			result = {
				success: true,
				errorMessage: ''
			};
		}

		return Promise.resolve(result);
	}

	schemaCompareCancel(_operationId: string): Thenable<azdata.ResultStatus> {
		let result: azdata.ResultStatus;
		if (this.testState === testStateScmp.FAILURE) {
			result = {
				success: false,
				errorMessage: 'Test failure'
			};
		}
		else {
			result = {
				success: true,
				errorMessage: ''
			};
		}

		return Promise.resolve(result);
	}

	handle?: number;
	readonly providerId: string = 'MSSQL';

	registerOnUpdated(_handler: () => any): void {
	}
}

export enum testStateScmp {
	SUCCESS_EQUAL,
	SUCCESS_NOT_EQUAL,
	FAILURE
}
