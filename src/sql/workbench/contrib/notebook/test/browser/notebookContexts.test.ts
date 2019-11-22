/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { NotebookContexts } from 'sql/workbench/contrib/notebook/browser/models/notebookContexts';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IDefaultConnection } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';

suite('Notebook Contexts', function (): void {
	const defaultContext = NotebookContexts['DefaultContext'];
	const localContext = NotebookContexts['LocalContext'];

	function createTestConnProfile(): ConnectionProfile {
		return new ConnectionProfile(new TestCapabilitiesService(), {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});
	}

	test('Get Contexts For Kernel', async function (): Promise<void> {

	});

	test('Get Active Contexts', async function (): Promise<void> {
		const connService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let testConnection = createTestConnProfile();

		// No provider IDs
		connService.setup(c => c.getActiveConnections()).returns(() => [testConnection]);
		let conns = NotebookContexts.getActiveContexts(connService.object, [], testConnection);
		assert.deepEqual(conns, localContext);

		// No connections
		connService.setup(c => c.getActiveConnections()).returns(() => []);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConnection);
		assert.deepEqual(conns, defaultContext);

		// No valid connection IDs
		testConnection.id = '-1';
		connService.setup(c => c.getActiveConnections()).returns(() => [testConnection]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConnection);
		assert.deepEqual(conns, defaultContext);

		// No valid provider IDs
		connService.setup(c => c.getActiveConnections()).returns(() => [testConnection]);
		conns = NotebookContexts.getActiveContexts(connService.object, ['notARealProvider'], testConnection);
		assert.deepEqual(conns, defaultContext);

		// Normal behavior, valid connection present
		testConnection.id = 'testId';
		connService.setup(c => c.getActiveConnections()).returns(() => [testConnection]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConnection);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [testConnection],
			defaultConnection: testConnection
		});

		// Multiple active connections
		let newTestConn = createTestConnProfile();
		newTestConn.serverName = 'otherTestServerName';
		connService.setup(c => c.getActiveConnections()).returns(() => [newTestConn, testConnection]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConnection);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [newTestConn, testConnection],
			defaultConnection: testConnection
		});

		// Multiple connections, no profile provided
		connService.setup(c => c.getActiveConnections()).returns(() => [newTestConn, testConnection]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], undefined);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [newTestConn, testConnection],
			defaultConnection: newTestConn
		});
	});
});
