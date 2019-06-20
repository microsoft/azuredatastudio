/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
import { ConnectionStatusManager } from 'sql/platform/connection/common/connectionStatusManager';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import { TestStorageService } from 'vs/workbench/test/workbenchTestServices';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { integrated, mssqlProviderName } from 'sql/platform/connection/common/constants';

const capabilitiesService = new CapabilitiesTestService();

suite('ConnectionManagementService Tests:', () => {
	test('getConnections test', () => {
		const connectionStatusManagerMock = TypeMoq.Mock.ofType(ConnectionStatusManager, TypeMoq.MockBehavior.Loose);
		const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());

		connectionStatusManagerMock.setup(x => x.getActiveConnectionProfiles(undefined)).returns(() => {
			return [createConnectionProfile('1'), createConnectionProfile('2')];
		});
		connectionStoreMock.setup(x => x.getRecentlyUsedConnections(undefined)).returns(() => {
			return [createConnectionProfile('1'), createConnectionProfile('3')];
		});

		const group1 = createConnectionGroup('group1');
		const group2 = createConnectionGroup('group2');
		group1.connections = [createConnectionProfile('1'), createConnectionProfile('4')];
		group1.children = [group2];
		group2.connections = [createConnectionProfile('5'), createConnectionProfile('6')];
		connectionStoreMock.setup(x => x.getConnectionProfileGroups(TypeMoq.It.isAny(), undefined)).returns(() => {
			return [group1];
		});
		const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, connectionStatusManagerMock.object, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

		// dupe connections have been seeded the numbers below already reflected the de-duped results

		const verifyConnections = (actualConnections: ConnectionProfile[], expectedConnectionIds: string[], scenario: string) => {
			assert.equal(actualConnections.length, expectedConnectionIds.length, 'incorrect number of connections returned, ' + scenario);
			assert.deepEqual(actualConnections.map(conn => conn.id).sort(), expectedConnectionIds.sort(), 'connections do not match expectation, ' + scenario);
		};

		// no parameter - default to false
		let connections = connectionManagementService.getConnections();
		verifyConnections(connections, ['1', '2', '3', '4', '5', '6'], 'no parameter provided');

		// explicitly set to false
		connections = connectionManagementService.getConnections(false);
		verifyConnections(connections, ['1', '2', '3', '4', '5', '6'], 'parameter is false');

		// active connections only
		connections = connectionManagementService.getConnections(true);
		verifyConnections(connections, ['1', '2'], 'parameter is true');
	});
});

function createConnectionProfile(id: string): ConnectionProfile {

	return new ConnectionProfile(capabilitiesService, {
		connectionName: 'newName',
		savePassword: false,
		groupFullName: 'testGroup',
		serverName: 'testServerName',
		databaseName: 'testDatabaseName',
		authenticationType: integrated,
		password: 'test',
		userName: 'testUsername',
		groupId: undefined,
		providerName: mssqlProviderName,
		options: {},
		saveProfile: true,
		id: id
	});
}

function createConnectionGroup(id: string): ConnectionProfileGroup {
	return new ConnectionProfileGroup(id, undefined, id, undefined, undefined);
}