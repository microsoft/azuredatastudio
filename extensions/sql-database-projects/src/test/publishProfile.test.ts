/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';
import { ProjectsController } from '../controllers/projectController';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { TestContext, createContext, mockDacFxOptionsResult } from './testContext';
import { load } from '../models/publishProfile/publishProfile';

let testContext: TestContext;

describe('Publish profile tests', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		testContext = createContext();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should read database name, integrated security connection string, and SQLCMD variables from publish profile', async function (): Promise<void> {
		await baselines.loadBaselines();
		let profilePath = await testUtils.createTestFile(baselines.publishProfileIntegratedSecurityBaseline, 'publishProfile.publish.xml');
		const connectionResult = {
			connected: true,
			connectionId: 'connId',
			errorMessage: '',
			errorCode: 0
		};
		testContext.dacFxService.setup(x => x.getOptionsFromProfile(TypeMoq.It.isAny())).returns(async () => {
			return Promise.resolve(mockDacFxOptionsResult);
		});
		const connectionString = 'Data Source=testserver;Integrated Security=true;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True';
		sinon.stub(azdata.connection, 'connect').resolves(connectionResult);
		sinon.stub(azdata.connection, 'getConnectionString').resolves(connectionString);

		let result = await load(vscode.Uri.file(profilePath), testContext.dacFxService.object);
		should(result.databaseName).equal('targetDb');
		should(Object.keys(result.sqlCmdVariables).length).equal(1);
		should(result.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(result.connectionId).equal('connId');
		should(result.connectionString).equal('Data Source=testserver;Integrated Security=true;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True');
		should(result.options).equal(mockDacFxOptionsResult.deploymentOptions);
	});

	it('Should read database name, SQL login connection string, and SQLCMD variables from publish profile', async function (): Promise<void> {
		await baselines.loadBaselines();
		let profilePath = await testUtils.createTestFile(baselines.publishProfileSqlLoginBaseline, 'publishProfile.publish.xml');
		const connectionResult = {
			providerName: 'MSSQL',
			connectionId: 'connId',
			options: {}
		};
		testContext.dacFxService.setup(x => x.getOptionsFromProfile(TypeMoq.It.isAny())).returns(async () => {
			return Promise.resolve(mockDacFxOptionsResult);
		});
		const connectionString = 'Data Source=testserver;User Id=testUser;Password=******;Integrated Security=false;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True';
		sinon.stub(azdata.connection, 'openConnectionDialog').resolves(connectionResult);
		sinon.stub(azdata.connection, 'getConnectionString').resolves(connectionString);

		let result = await load(vscode.Uri.file(profilePath), testContext.dacFxService.object);
		should(result.databaseName).equal('targetDb');
		should(Object.keys(result.sqlCmdVariables).length).equal(1);
		should(result.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(result.connectionId).equal('connId');
		should(result.connectionString).equal('Data Source=testserver;User Id=testUser;Password=******;Integrated Security=false;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True');
		should(result.options).equal(mockDacFxOptionsResult.deploymentOptions);
	});

	it('Should throw error when connecting does not work', async function (): Promise<void> {
		await baselines.loadBaselines();
		let profilePath = await testUtils.createTestFile(baselines.publishProfileIntegratedSecurityBaseline, 'publishProfile.publish.xml');
		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

		const connectionString = 'Data Source=testserver;Integrated Security=true;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=60;Encrypt=False;TrustServerCertificate=True';
		sinon.stub(azdata.connection, 'connect').throws(new Error('Could not connect'));
		sinon.stub(azdata.connection, 'getConnectionString').resolves(connectionString);

		await testUtils.shouldThrowSpecificError(async () => await projController.readPublishProfileCallback(vscode.Uri.file(profilePath)), constants.unableToCreatePublishConnection('Could not connect'));
	});
});
