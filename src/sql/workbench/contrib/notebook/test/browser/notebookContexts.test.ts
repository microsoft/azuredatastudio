/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { nb } from 'azdata';
import { NotebookContexts } from 'sql/workbench/contrib/notebook/browser/models/notebookContexts';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IDefaultConnection } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';

suite('Notebook Contexts', function (): void {
	const defaultContext = NotebookContexts.DefaultContext;
	const localContext = NotebookContexts.LocalContext;

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
		const connService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		// No kernel or profile info provided
		let conns = NotebookContexts.getContextsForKernel(connService.object, [mssqlProviderName]);
		assert.deepEqual(conns, defaultContext);

		// No Profile, Kernels are the same
		let kernelChangeArgs = <nb.IKernelChangedArgs>{
			oldValue: <nb.IKernel>{
				id: '1',
				name: 'TestKernel'
			},
			newValue: <nb.IKernel>{
				id: '1',
				name: 'TestKernel'
			}
		};
		conns = NotebookContexts.getContextsForKernel(connService.object, [mssqlProviderName], kernelChangeArgs);
		assert.deepEqual(conns, defaultContext);

		// Kernel Info and Profile, but no provider IDs
		let testConn = createTestConnProfile();
		conns = NotebookContexts.getContextsForKernel(connService.object, [], kernelChangeArgs, testConn);
		assert.deepEqual(conns, defaultContext);

		// Normal use case
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getContextsForKernel(connService.object, [mssqlProviderName], kernelChangeArgs, testConn);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [testConn],
			defaultConnection: testConn
		});
	});

	test('Get Active Contexts', async function (): Promise<void> {
		const connService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let testConn = createTestConnProfile();

		// No provider IDs
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		let conns = NotebookContexts.getActiveContexts(connService.object, [], testConn);
		assert.deepEqual(conns, localContext);

		// No connections
		connService.setup(c => c.getActiveConnections()).returns(() => []);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConn);
		assert.deepEqual(conns, defaultContext);

		// No valid connection IDs
		testConn.id = '-1';
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConn);
		assert.deepEqual(conns, defaultContext);

		// No matching provider IDs
		testConn.id = 'testId';
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getActiveContexts(connService.object, ['notARealProvider'], testConn);
		assert.deepEqual(conns, defaultContext);

		// Normal behavior, valid connection present
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConn);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [testConn],
			defaultConnection: testConn
		});

		// Multiple active connections
		let newTestConn = createTestConnProfile();
		newTestConn.serverName = 'otherTestServerName';
		connService.setup(c => c.getActiveConnections()).returns(() => [newTestConn, testConn]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], testConn);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [newTestConn, testConn],
			defaultConnection: testConn
		});

		// Multiple connections, no profile provided
		connService.setup(c => c.getActiveConnections()).returns(() => [newTestConn, testConn]);
		conns = NotebookContexts.getActiveContexts(connService.object, [mssqlProviderName], undefined);
		assert.deepEqual(conns, <IDefaultConnection>{
			otherConnections: [newTestConn, testConn],
			defaultConnection: newTestConn
		});
	});
});
