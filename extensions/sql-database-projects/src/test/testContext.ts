/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as mssql from 'mssql';

export interface TestContext {
	context: vscode.ExtensionContext;
	dacFxService: TypeMoq.IMock<mssql.IDacFxService>;
	outputChannel: vscode.OutputChannel;
}

export const mockDacFxResult = {
	operationId: '',
	success: true,
	errorMessage: '',
	report: ''
};

export const mockSavePublishResult = {
	success: true,
	errorMessage: ''
};

/* Get the deployment options sample model */
export function getDeploymentOptions(): mssql.DeploymentOptions {
	const sampleDesc = 'Sample Description text';
	const sampleName = 'Sample Display Name';
	const defaultOptions: mssql.DeploymentOptions = {
		excludeObjectTypes: { value: [], description: sampleDesc, displayName: sampleName },
		booleanOptionsDictionary: {
			'SampleProperty1': { value: false, description: sampleDesc, displayName: sampleName },
			'SampleProperty2': { value: false, description: sampleDesc, displayName: sampleName }
		},
		objectTypesDictionary: {
			'SampleProperty1': sampleName,
			'SampleProperty2': sampleName
		}
	};
	return defaultOptions;
}

export const mockDacFxOptionsResult: mssql.DacFxOptionsResult = {
	success: true,
	errorMessage: '',
	deploymentOptions: getDeploymentOptions()
};

export class MockDacFxService implements mssql.IDacFxService {
	public exportBacpac(_databaseName: string, _packageFilePath: string, _ownerUri: string, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public importBacpac(_packageFilePath: string, _databaseName: string, _ownerUri: string, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public extractDacpac(_databaseName: string, _packageFilePath: string, _applicationName: string, _applicationVersion: string, _ownerUri: string, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public createProjectFromDatabase(_databaseName: string, _targetFilePath: string, _applicationName: string, _applicationVersion: string, _ownerUri: string, _extractTarget: mssql.ExtractTarget, _taskExecutionMode: azdata.TaskExecutionMode, _includePermissions?: boolean): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public deployDacpac(_packageFilePath: string, _targetDatabaseName: string, _upgradeExisting: boolean, _ownerUri: string, _taskExecutionMode: azdata.TaskExecutionMode, _sqlCommandVariableValues?: Map<string, string>, _deploymentOptions?: mssql.DeploymentOptions): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployScript(_packageFilePath: string, _targetDatabaseName: string, _ownerUri: string, _taskExecutionMode: azdata.TaskExecutionMode, _sqlCommandVariableValues?: Map<string, string>, _deploymentOptions?: mssql.DeploymentOptions): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployPlan(_packageFilePath: string, _targetDatabaseName: string, _ownerUri: string, _taskExecutionMode: azdata.TaskExecutionMode): Thenable<mssql.GenerateDeployPlanResult> { return Promise.resolve(mockDacFxResult); }
	public getOptionsFromProfile(_profilePath: string): Thenable<mssql.DacFxOptionsResult> { return Promise.resolve(mockDacFxOptionsResult); }
	public validateStreamingJob(_packageFilePath: string, _createStreamingJobTsql: string): Thenable<mssql.ValidateStreamingJobResult> { return Promise.resolve(mockDacFxResult); }
	public parseTSqlScript(_filePath: string, _databaseSchemaProvider: string): Thenable<mssql.ParseTSqlScriptResult> { return Promise.resolve({ containsCreateTableStatement: true }); }
	public savePublishProfile(_profilePath: string, _databaseName: string, _connectionString: string, _sqlCommandVariableValues?: Map<string, string>, _deploymentOptions?: mssql.DeploymentOptions): Thenable<azdata.ResultStatus> { return Promise.resolve(mockSavePublishResult); }
}

export function createContext(): TestContext {
	let extensionPath = path.join(__dirname, '..', '..');

	return {
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => { return undefined; },
				update: () => { return Promise.resolve(); },
				keys: () => []
			},
			globalState: {
				setKeysForSync: (): void => { },
				get: (): any | undefined => { return Promise.resolve(); },
				update: (): Thenable<void> => { return Promise.resolve(); },
				keys: () => []
			},
			extensionPath: extensionPath,
			asAbsolutePath: () => { return ''; },
			storagePath: '',
			globalStoragePath: '',
			logPath: '',
			extensionUri: vscode.Uri.parse(''),
			environmentVariableCollection: undefined as any,
			extensionMode: undefined as any,
			globalStorageUri: vscode.Uri.parse('test://'),
			logUri: vscode.Uri.parse('test://'),
			storageUri: vscode.Uri.parse('test://'),
			secrets: undefined as any,
			extension: undefined as any
		},
		dacFxService: TypeMoq.Mock.ofType(MockDacFxService),
		outputChannel: {
			name: '',
			append: () => { },
			appendLine: () => { },
			clear: () => { },
			show: () => { },
			hide: () => { },
			dispose: () => { },
			replace: () => { }
		}
	};
}

// Mock test data
export const mockConnectionProfile: azdata.IConnectionProfile = {
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: azdata.connection.AuthenticationType.SqlLogin,
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	providerName: 'My Server',
	saveProfile: true,
	id: 'My Id',
	options: {
		server: 'My Server',
		database: 'My Database',
		user: 'My User',
		password: 'My Pwd',
		authenticationType: azdata.connection.AuthenticationType.SqlLogin,
		connectionName: 'My Connection Name'
	}
};

export const mockURIList: vscode.Uri[] = [
	vscode.Uri.file('/test/folder/abc.sqlproj'),
	vscode.Uri.file('/test/folder/folder1/abc1.sqlproj'),
	vscode.Uri.file('/test/folder/folder2/abc2.sqlproj')
];

export const mockConnectionInfo = {
	id: undefined,
	userName: 'My User',
	password: 'My Pwd',
	serverName: 'My Server',
	databaseName: 'My Database',
	connectionName: 'My Connection',
	providerName: undefined,
	groupId: 'My GroupId',
	groupFullName: 'My groupName',
	authenticationType: azdata.connection.AuthenticationType.SqlLogin,
	savePassword: false,
	saveProfile: true,
	options: {
		server: 'My Server',
		database: 'My Database',
		user: 'My User',
		password: 'My Pwd',
		authenticationType: 'SqlLogin',
		connectionName: 'My Connection Name'
	}
};

export const mockProjectEndpointInfo: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Project,
	projectFilePath: '',
	extractTarget: mssql.ExtractTarget.schemaObjectType,
	targetScripts: [],
	dataSchemaProvider: '150',
	connectionDetails: mockConnectionInfo,
	databaseName: '',
	serverDisplayName: '',
	serverName: '',
	ownerUri: '',
	packageFilePath: ''
};

export const mockDatabaseEndpointInfo: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Database,
	databaseName: 'My Database',
	serverDisplayName: 'My Connection Name',
	serverName: 'My Server',
	connectionDetails: mockConnectionInfo,
	ownerUri: 'MockUri',
	projectFilePath: '',
	extractTarget: mssql.ExtractTarget.schemaObjectType,
	targetScripts: [],
	dataSchemaProvider: '',
	packageFilePath: '',
	connectionName: 'My Connection Name'
};
