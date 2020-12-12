/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { NotebookContexts } from 'sql/workbench/services/notebook/browser/models/notebookContexts';
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
		const connService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		// No profile info provided
		let conns = NotebookContexts.getContextForKernel(undefined, [mssqlProviderName]);
		assert.deepStrictEqual(conns, defaultContext, 'Contexts not the same when no profile info passed in');

		// Profile, but no provider IDs
		let testConn = createTestConnProfile();
		conns = NotebookContexts.getContextForKernel(testConn, []);
		assert.deepStrictEqual(conns, localContext, 'Contexts not the same when no provider ids passed in');

		// Normal use case
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getContextForKernel(testConn, [mssqlProviderName]);
		assert.deepStrictEqual(conns, testConn, 'Contexts not the same when testing mssql provider connections');

		// Multiple provider IDs including mssql
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getContextForKernel(testConn, [mssqlProviderName, 'fakeProvider']);
		assert.deepStrictEqual(conns, testConn, 'Contexts not the same when multiple providers passed in');

		// Connection provider IDs do not match
		connService.setup(c => c.getActiveConnections()).returns(() => [testConn]);
		conns = NotebookContexts.getContextForKernel(testConn, ['fakeProvider']);
		assert.deepStrictEqual(conns, defaultContext, 'Contexts not the same when provider ids do not match');
	});
});
