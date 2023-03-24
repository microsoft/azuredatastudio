/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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

	schemaComparePublishDatabaseChanges(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaComparePublishProjectChanges(_: string, __: string, ___: mssql.ExtractTarget, ____: azdata.TaskExecutionMode): Thenable<mssql.SchemaComparePublishProjectResult> {
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

	schemaCompareIncludeExcludeNode(_: string, __: mssql.DiffEntry, ___: boolean, ____: azdata.TaskExecutionMode): Thenable<mssql.SchemaCompareIncludeExcludeResult> {
		throw new Error('Method not implemented.');
	}

	schemaCompareOpenScmp(_: string): Thenable<mssql.SchemaCompareOpenScmpResult> {
		throw new Error('Method not implemented.');
	}

	schemaCompareSaveScmp(_: mssql.SchemaCompareEndpointInfo, __: mssql.SchemaCompareEndpointInfo, ____: azdata.TaskExecutionMode, _____: mssql.DeploymentOptions, ______: string, _______: mssql.SchemaCompareObjectId[], ________: mssql.SchemaCompareObjectId[]): Thenable<azdata.ResultStatus> {
		throw new Error('Method not implemented.');
	}

	schemaCompare(_: string, __: mssql.SchemaCompareEndpointInfo, ___: mssql.SchemaCompareEndpointInfo, ____: azdata.TaskExecutionMode, _____: mssql.DeploymentOptions): Thenable<mssql.SchemaCompareResult> {
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

	schemaCompareGenerateScript(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> {
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

	schemaCompareCancel(_: string): Thenable<azdata.ResultStatus> {
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

	registerOnUpdated(_: () => any): void {
	}
}

export enum testStateScmp {
	SUCCESS_EQUAL,
	SUCCESS_NOT_EQUAL,
	FAILURE
}
