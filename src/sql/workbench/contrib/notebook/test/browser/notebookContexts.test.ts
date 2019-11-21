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

	});

	test('Get Active Contexts', async function (): Promise<void> {
		const connService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let testConnection = createTestConnProfile();

		// No connProviderIds
		connService.setup(c => c.getActiveConnections()).returns(() => [testConnection]);
		let conns = NotebookContexts.getActiveContexts(connService.object, [], testConnection);
		assert.deepEqual(conns, localContext);

		// No connections
		connService.setup(c => c.getActiveConnections()).returns(() => []);
		conns = NotebookContexts.getActiveContexts(connService.object, ['TestId'], testConnection);
		assert.deepEqual(conns, defaultContext);

		// No valid connection IDs
		testConnection.id = '-1';
		connService.setup(c => c.getActiveConnections()).returns(() => [testConnection]);
		conns = NotebookContexts.getActiveContexts(connService.object, ['TestId'], testConnection);
		assert.deepEqual(conns, defaultContext);
	});
});
