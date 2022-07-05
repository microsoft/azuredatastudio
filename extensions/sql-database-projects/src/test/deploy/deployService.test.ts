/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as baselines from '../baselines/baselines';
import * as testUtils from '../testUtils';
import { DeployService, getDockerImageSpec } from '../../models/deploy/deployService';
import { Project } from '../../models/project';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { ISqlDbDeployProfile } from '../../models/deploy/deployProfile';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as constants from '../../common/constants';
import { ShellExecutionHelper } from '../../tools/shellExecutionHelper';
import * as TypeMoq from 'typemoq';
import { AzureSqlClient } from '../../models/deploy/azureSqlClient';
import { ConnectionService } from '../../models/connections/connectionService';
import { IPublishToDockerSettings } from 'sqldbproj';

export interface TestContext {
	outputChannel: vscode.OutputChannel;
	azureSqlClient: TypeMoq.IMock<AzureSqlClient>;
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
		},
		azureSqlClient: TypeMoq.Mock.ofType(AzureSqlClient)
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
		const deployProfile: IPublishToDockerSettings = {
			sqlProjectPublishSettings: {
				databaseName: 'dbName',
				serverName: 'serverName',
				connectionUri: 'connectionUri'
			},
			dockerSettings: {
				dbName: 'test',
				password: 'PLACEHOLDER',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				dockerBaseImage: 'image',
				connectionRetryTimeout: 1,
				dockerBaseImageEula: ''
			}
		};
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
		const shellExecutionHelper = TypeMoq.Mock.ofType(ShellExecutionHelper);
		shellExecutionHelper.setup(x => x.runStreamedCommand(TypeMoq.It.isAny(),
			undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('id'));
		const deployService = new DeployService(testContext.azureSqlClient.object, testContext.outputChannel, shellExecutionHelper.object);
		sandbox.stub(azdata.connection, 'connect').returns(Promise.resolve(mockConnectionResult));
		sandbox.stub(azdata.connection, 'getUriForConnection').returns(Promise.resolve('connection'));
		sandbox.stub(vscode.window, 'showQuickPick').returns(<any>Promise.resolve(constants.yesString));
		sandbox.stub(azdata.tasks, 'startBackgroundOperation').callThrough();

		let connection = await deployService.deployToContainer(deployProfile, project1);
		should(connection).equals('connection');

	});

	it('Should fail the deploy if docker is not running', async function (): Promise<void> {
		const testContext = createContext();
		const deployProfile: IPublishToDockerSettings = {
			sqlProjectPublishSettings: {
				databaseName: 'dbName',
				serverName: 'serverName',
				connectionUri: 'connectionUri'
			},
			dockerSettings: {
				dbName: 'test',
				password: 'PLACEHOLDER',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				dockerBaseImage: 'image',
				connectionRetryTimeout: 1,
				dockerBaseImageEula: ''
			}
		};
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
		const shellExecutionHelper = TypeMoq.Mock.ofType(ShellExecutionHelper);
		shellExecutionHelper.setup(x => x.runStreamedCommand(TypeMoq.It.isAny(),
			undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.reject('error'));
		const deployService = new DeployService(testContext.azureSqlClient.object, testContext.outputChannel, shellExecutionHelper.object);
		sandbox.stub(azdata.tasks, 'startBackgroundOperation').callThrough();

		await should(deployService.deployToContainer(deployProfile, project1)).rejected();
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
			connectionRetryTimeout: 1,
			dockerBaseImageEula: ''
		};

		const shellExecutionHelper = TypeMoq.Mock.ofType(ShellExecutionHelper);
		shellExecutionHelper.setup(x => x.runStreamedCommand(TypeMoq.It.isAny(),
			undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('id'));
		const connectionService = new ConnectionService(testContext.outputChannel);
		let connectionStub = sandbox.stub(azdata.connection, 'connect');
		connectionStub.onFirstCall().returns(Promise.resolve(mockFailedConnectionResult));
		connectionStub.onSecondCall().returns(Promise.resolve(mockConnectionResult));
		sandbox.stub(azdata.connection, 'getUriForConnection').returns(Promise.resolve('connection'));
		sandbox.stub(azdata.tasks, 'startBackgroundOperation').callThrough();

		let connection = await connectionService.getConnection(localDbSettings, false, 'master');
		should(connection).equals('connection');
	});

	it('Should clean a list of docker images successfully', async function (): Promise<void> {
		const testContext = createContext();
		const shellExecutionHelper = TypeMoq.Mock.ofType(ShellExecutionHelper);
		shellExecutionHelper.setup(x => x.runStreamedCommand(TypeMoq.It.isAny(),
			undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(`id
		id2
		id3`));
		const deployService = new DeployService(testContext.azureSqlClient.object, testContext.outputChannel, shellExecutionHelper.object);
		const ids = await deployService.getCurrentDockerContainer('label');
		await deployService.cleanDockerObjects(ids, ['docker stop', 'docker rm']);
		shellExecutionHelper.verify(x => x.runStreamedCommand(TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(7));
	});

	it('Should create docker image info correctly', () => {
		const id = UUID.generateUuid().toLocaleLowerCase();
		const baseImage = 'baseImage:latest';
		const tag = baseImage.replace(':', '-').replace(constants.sqlServerDockerRegistry, '').replace(/[^a-zA-Z0-9_,\-]/g, '').toLocaleLowerCase();

		should(getDockerImageSpec('project-name123_test', baseImage, id)).deepEqual({
			label: `${constants.dockerImageLabelPrefix}-project-name123_test`,
			containerName: `${constants.dockerImageNamePrefix}-project-name123_test-${id}`,
			tag: `${constants.dockerImageNamePrefix}-project-name123_test-${tag}`
		});
		should(getDockerImageSpec('project-name1', baseImage, id)).deepEqual({
			label: `${constants.dockerImageLabelPrefix}-project-name1`,
			containerName: `${constants.dockerImageNamePrefix}-project-name1-${id}`,
			tag: `${constants.dockerImageNamePrefix}-project-name1-${tag}`
		});
		should(getDockerImageSpec('project-name2$#', baseImage, id)).deepEqual({
			label: `${constants.dockerImageLabelPrefix}-project-name2`,
			containerName: `${constants.dockerImageNamePrefix}-project-name2-${id}`,
			tag: `${constants.dockerImageNamePrefix}-project-name2-${tag}`
		});
		should(getDockerImageSpec('project - name3', baseImage, id)).deepEqual({
			label: `${constants.dockerImageLabelPrefix}-project-name3`,
			containerName: `${constants.dockerImageNamePrefix}-project-name3-${id}`,
			tag: `${constants.dockerImageNamePrefix}-project-name3-${tag}`
		});
		should(getDockerImageSpec('project_name4', baseImage, id)).deepEqual({
			label: `${constants.dockerImageLabelPrefix}-project_name4`,
			containerName: `${constants.dockerImageNamePrefix}-project_name4-${id}`,
			tag: `${constants.dockerImageNamePrefix}-project_name4-${tag}`
		});


		const reallyLongName = new Array(128 + 1).join('a').replace(/[^a-zA-Z0-9_,\-]/g, '');
		const imageProjectName = reallyLongName.substring(0, 128 - (constants.dockerImageNamePrefix.length + tag.length + 2));
		should(getDockerImageSpec(reallyLongName, baseImage, id)).deepEqual({
			label: `${constants.dockerImageLabelPrefix}-${imageProjectName}`,
			containerName: `${constants.dockerImageNamePrefix}-${imageProjectName}-${id}`,
			tag: `${constants.dockerImageNamePrefix}-${imageProjectName}-${tag}`
		});
	});

	it('Should create a new Azure SQL server successfully', async function (): Promise<void> {
		const testContext = createContext();
		const deployProfile: ISqlDbDeployProfile = {
			sqlDbSetting: {
				dbName: 'test',
				password: 'PLACEHOLDER',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				connectionRetryTimeout: 1,
				resourceGroupName: 'resourceGroups',
				session: {
					subscription: {
						subscriptionId: 'subscriptionId',
					},token: {
						key: '',
						token: '',
						tokenType: '',
					},
					tenantId: '',
					account: undefined!
				},
				location: 'location'
			}
		};
		const fullyQualifiedDomainName = 'servername';
		const shellExecutionHelper = TypeMoq.Mock.ofType(ShellExecutionHelper);
		shellExecutionHelper.setup(x => x.runStreamedCommand(TypeMoq.It.isAny(),
			undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('id'));
		const session = deployProfile?.sqlDbSetting?.session;
		if (deployProfile?.sqlDbSetting?.session && session) {
			testContext.azureSqlClient.setup(x => x.createOrUpdateServer(
				session,
				deployProfile.sqlDbSetting?.resourceGroupName || '',
				deployProfile.sqlDbSetting?.serverName || '',
				{
					location: deployProfile?.sqlDbSetting?.location || '',
					administratorLogin: deployProfile?.sqlDbSetting?.userName,
					administratorLoginPassword: deployProfile?.sqlDbSetting?.password
				})).returns(() => Promise.resolve(fullyQualifiedDomainName));
		}
		sandbox.stub(azdata.connection, 'connect').returns(Promise.resolve(mockConnectionResult));
		sandbox.stub(azdata.connection, 'getUriForConnection').returns(Promise.resolve('connection'));
		const deployService = new DeployService(testContext.azureSqlClient.object, testContext.outputChannel, shellExecutionHelper.object);
		let connection = await deployService.createNewAzureSqlServer(deployProfile);
		should(deployProfile.sqlDbSetting?.serverName).equal(fullyQualifiedDomainName);
		should(connection).equals('connection');
	});
});
