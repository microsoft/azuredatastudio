/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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

/* Get the deployment options sample model */
export function getDeploymentOptions(): mssql.DeploymentOptions {
	const sampleDesc = 'Sample Description text';
	const sampleName = 'Sample Display Name';
	const defaultOptions: mssql.DeploymentOptions = {
		excludeObjectTypes: { value: [], description: sampleDesc, displayName: sampleName },
		booleanOptionsDictionary: {
			'SampleProperty1': { value: false, description: sampleDesc, displayName: sampleName },
			'SampleProperty2': { value: false, description: sampleDesc, displayName: sampleName }
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
	public exportBacpac(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public importBacpac(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public extractDacpac(_: string, __: string, ___: string, ____: string, _____: string, ______: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public createProjectFromDatabase(_: string, __: string, ___: string, ____: string, _____: string, ______: mssql.ExtractTarget, _______: azdata.TaskExecutionMode): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public deployDacpac(_: string, __: string, ___: boolean, ____: string, _____: azdata.TaskExecutionMode, ______?: Record<string, string>): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployScript(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode, ______?: Record<string, string>): Thenable<mssql.DacFxResult> { return Promise.resolve(mockDacFxResult); }
	public generateDeployPlan(_: string, __: string, ___: string, ____: azdata.TaskExecutionMode): Thenable<mssql.GenerateDeployPlanResult> { return Promise.resolve(mockDacFxResult); }
	public getOptionsFromProfile(_: string): Thenable<mssql.DacFxOptionsResult> { return Promise.resolve(mockDacFxOptionsResult); }
	public validateStreamingJob(_: string, __: string): Thenable<mssql.ValidateStreamingJobResult> { return Promise.resolve(mockDacFxResult); }
	public parseTSqlScript(_: string, __: string): Thenable<mssql.ParseTSqlScriptResult> { return Promise.resolve({ containsCreateTableStatement: true }); }
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
			dispose: () => { }
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
	authenticationType: 'SqlLogin',
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
		authenticationType: 'SqlLogin',
		connectionName: 'My Connection Name'
	}
};
