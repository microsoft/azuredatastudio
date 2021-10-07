/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as baselines from '../baselines/baselines';
import * as testUtils from '../testUtils';
import { DeployService } from '../../models/deploy/deployService';
import { Project } from '../../models/project';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as childProcess from 'child_process';
import { AppSettingType, IDeployProfile } from '../../models/deploy/deployProfile';
let fse = require('fs-extra');
let path = require('path');
import * as constants from '../../common/constants';

export interface TestContext {
	outputChannel: vscode.OutputChannel;
}

export const mockConnectionResult: azdata.ConnectionResult = {
	connected: true,
	connectionId: 'id',
	errorMessage: '',
	errorCode: 0
};

export const mockFailedConnectionResult: azdata.ConnectionResult = {
	connected: false,
	connectionId: 'id',
	errorMessage: 'Failed to connect',
	errorCode: 0
};

export function createContext(): TestContext {
	return {
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

let sandbox: sinon.SinonSandbox;

describe('deploy service', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});
	afterEach(function () {
		sandbox.restore();
		sinon.restore();
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	it('Should deploy a database to docker container successfully', async function (): Promise<void> {
		const testContext = createContext();
		const deployProfile: IDeployProfile = {
			localDbSetting: {
				dbName: 'test',
				password: 'PLACEHOLDER',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				dockerBaseImage: 'image',
				connectionRetryTimeout: 1
			}
		};
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
		const deployService = new DeployService(testContext.outputChannel);
		sandbox.stub(azdata.connection, 'connect').returns(Promise.resolve(mockConnectionResult));
		sandbox.stub(azdata.connection, 'getUriForConnection').returns(Promise.resolve('connection'));
		sandbox.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));
		sandbox.stub(azdata.tasks, 'startBackgroundOperation').callThrough();
		sandbox.stub(childProcess, 'exec').yields(undefined, 'id');
		let connection = await deployService.deploy(deployProfile, project1);
		should(connection).equals('connection');

	});

	it('Should deploy fails if docker is not running', async function (): Promise<void> {
		const testContext = createContext();
		const deployProfile: IDeployProfile = {
			localDbSetting: {
				dbName: 'test',
				password: 'PLACEHOLDER',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				dockerBaseImage: 'image',
				connectionRetryTimeout: 1
			}
		};
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
		const deployService = new DeployService(testContext.outputChannel);
		sandbox.stub(azdata.tasks, 'startBackgroundOperation').callThrough();
		sandbox.stub(childProcess, 'exec').throws('error');
		await should(deployService.deploy(deployProfile, project1)).rejected();
	});

	it('Should retry connecting to the server', async function (): Promise<void> {
		const testContext = createContext();
		const localDbSettings = {
			dbName: 'test',
			password: 'PLACEHOLDER',
			port: 1433,
			serverName: 'localhost',
			userName: 'sa',
			dockerBaseImage: 'image',
			connectionRetryTimeout: 1
		};

		const deployService = new DeployService(testContext.outputChannel);
		let connectionStub = sandbox.stub(azdata.connection, 'connect');
		connectionStub.onFirstCall().returns(Promise.resolve(mockFailedConnectionResult));
		connectionStub.onSecondCall().returns(Promise.resolve(mockConnectionResult));
		sandbox.stub(azdata.connection, 'getUriForConnection').returns(Promise.resolve('connection'));
		sandbox.stub(azdata.tasks, 'startBackgroundOperation').callThrough();
		sandbox.stub(childProcess, 'exec').yields(undefined, 'id');
		let connection = await deployService.getConnection(localDbSettings, false, 'master');
		should(connection).equals('connection');
	});

	it('Should update app settings successfully', async function (): Promise<void> {
		const testContext = createContext();
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
		const jsondData =
		{
			IsEncrypted: false,
			Values: {
				AzureWebJobsStorage: 'UseDevelopmentStorage=true',
				FUNCTIONS_WORKER_RUNTIME: 'dotnet'
			}
		};
		let settingContent = JSON.stringify(jsondData, undefined, 4);
		const expected =
		{
			IsEncrypted: false,
			Values: {
				AzureWebJobsStorage: 'UseDevelopmentStorage=true',
				FUNCTIONS_WORKER_RUNTIME: 'dotnet',
				SQLConnectionString: 'Data Source=localhost,1433;Initial Catalog=test;User id=sa;Password=PLACEHOLDER;'
			}
		};
		const filePath = path.join(project1.projectFolderPath, 'local.settings.json');
		await fse.writeFile(filePath, settingContent);

		const deployProfile: IDeployProfile = {
			localDbSetting: {
				dbName: 'test',
				password: 'PLACEHOLDER',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				dockerBaseImage: 'image'
			}
		};

		const appInteg = {
			appSettingType: AppSettingType.AzureFunction,
			appSettingFile: filePath,
			deploySettings: undefined,
			envVariableName: 'SQLConnectionString'
		};

		const deployService = new DeployService(testContext.outputChannel);
		sandbox.stub(childProcess, 'exec').yields(undefined, 'id');
		await deployService.updateAppSettings(appInteg, deployProfile);
		let newContent = JSON.parse(fse.readFileSync(filePath, 'utf8'));
		should(newContent).deepEqual(expected);

	});

	it('Should update app settings using connection uri if there are no local settings', async function (): Promise<void> {
		const testContext = createContext();
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
		const jsondData =
		{
			IsEncrypted: false,
			Values: {
				AzureWebJobsStorage: 'UseDevelopmentStorage=true',
				FUNCTIONS_WORKER_RUNTIME: 'dotnet'
			}
		};
		let settingContent = JSON.stringify(jsondData, undefined, 4);
		const expected =
		{
			IsEncrypted: false,
			Values: {
				AzureWebJobsStorage: 'UseDevelopmentStorage=true',
				FUNCTIONS_WORKER_RUNTIME: 'dotnet',
				SQLConnectionString: 'connectionString'
			}
		};
		const filePath = path.join(project1.projectFolderPath, 'local.settings.json');
		await fse.writeFile(filePath, settingContent);

		const deployProfile: IDeployProfile = {

			deploySettings: {
				connectionUri: 'connection',
				databaseName: 'test',
				serverName: 'test'
			},
			localDbSetting: undefined
		};

		const appInteg = {
			appSettingType: AppSettingType.AzureFunction,
			appSettingFile: filePath,
			envVariableName: 'SQLConnectionString',
		};
		const deployService = new DeployService(testContext.outputChannel);
		let connection = new azdata.connection.ConnectionProfile();
		sandbox.stub(azdata.connection, 'getConnection').returns(Promise.resolve(connection));
		sandbox.stub(childProcess, 'exec').yields(undefined, 'id');
		sandbox.stub(azdata.connection, 'getConnectionString').returns(Promise.resolve('connectionString'));
		await deployService.updateAppSettings(appInteg, deployProfile);
		let newContent = JSON.parse(fse.readFileSync(filePath, 'utf8'));
		should(newContent).deepEqual(expected);
	});

	it('Should clean a list of docker images successfully', async function (): Promise<void> {
		const testContext = createContext();
		const deployService = new DeployService(testContext.outputChannel);

		let process = sandbox.stub(childProcess, 'exec').yields(undefined, `
		id
		id2
		id3`);

		const ids = await deployService.getCurrentDockerContainer('label');
		await deployService.cleanDockerObjects(ids, ['docker stop', 'docker rm']);
		should(process.calledThrice);
	});
});
