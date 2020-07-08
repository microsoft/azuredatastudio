/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';
import { TestContext, createContext } from './testContext';
import { ProjectsController } from '../controllers/projectController';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';

let testContext: TestContext;

describe('Publish profile tests', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		testContext = createContext();
	});

	it('Should read database name, integrated security connection string, and SQLCMD variables from publish profile', async function (): Promise<void> {
		await baselines.loadBaselines();
		let profilePath = await testUtils.createTestFile(baselines.publishProfileIntegratedSecurityBaseline, 'publishProfile.publish.xml');
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const connectionResult = {
			connected: true,
			connectionId: 'connId',
			errorMessage: '',
			errorCode: 0
		};
		const connectionString = 'Data Source=testserver;Integrated Security=true;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True';
		testContext.apiWrapper.setup(x => x.connectionConnect(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => Promise.resolve(connectionResult));
		testContext.apiWrapper.setup(x => x.getConnectionString(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => Promise.resolve(connectionString));

		let result = await projController.readPublishProfileCallback(vscode.Uri.file(profilePath));
		should(result.databaseName).equal('targetDb');
		should(Object.keys(result.sqlCmdVariables).length).equal(1);
		should(result.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(result.connectionId).equal('connId');
		should(result.connectionString).equal('Data Source=testserver;Integrated Security=true;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True');
	});

	it('Should read database name, SQL login connection string, and SQLCMD variables from publish profile', async function (): Promise<void> {
		await baselines.loadBaselines();
		let profilePath = await testUtils.createTestFile(baselines.publishProfileSqlLoginBaseline, 'publishProfile.publish.xml');
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const connectionResult = {
			providerName: 'MSSQL',
			connectionId: 'connId',
			options: {}
		};
		const connectionString = 'Data Source=testserver;User Id=testUser;Password=******;Integrated Security=false;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True';
		testContext.apiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => Promise.resolve(connectionResult));
		testContext.apiWrapper.setup(x => x.getConnectionString(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => Promise.resolve(connectionString));

		let result = await projController.readPublishProfileCallback(vscode.Uri.file(profilePath));
		should(result.databaseName).equal('targetDb');
		should(Object.keys(result.sqlCmdVariables).length).equal(1);
		should(result.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(result.connectionId).equal('connId');
		should(result.connectionString).equal('Data Source=testserver;User Id=testUser;Password=******;Integrated Security=false;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True');
	});

	it('Should throw error when connecting does not work', async function (): Promise<void> {
		await baselines.loadBaselines();
		let profilePath = await testUtils.createTestFile(baselines.publishProfileIntegratedSecurityBaseline, 'publishProfile.publish.xml');
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		const connectionString = 'Data Source=testserver;User Id=testUser;Password=******;Integrated Security=false;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True';
		testContext.apiWrapper.setup(x => x.connectionConnect(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { throw new Error('Could not connect'); });
		testContext.apiWrapper.setup(x => x.getConnectionString(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => Promise.resolve(connectionString));

		await testUtils.shouldThrowSpecificError(async () => await projController.readPublishProfileCallback(vscode.Uri.file(profilePath)), constants.unableToCreatePublishConnection('Could not connect'));
	});
});
