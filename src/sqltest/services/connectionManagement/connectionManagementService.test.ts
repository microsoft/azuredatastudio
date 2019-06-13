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
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';

const sqlProvider = {
	providerId: 'MSSQL',
	displayName: 'MSSQL',
	connectionOptions: [
		{
			name: 'connectionName',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: true,
			isRequired: true,
			specialValueType: ConnectionOptionSpecialType.connectionName,
			valueType: ServiceOptionType.string
		},
		{
			name: 'serverName',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: true,
			isRequired: true,
			specialValueType: ConnectionOptionSpecialType.serverName,
			valueType: ServiceOptionType.string
		},
		{
			name: 'databaseName',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: true,
			isRequired: true,
			specialValueType: ConnectionOptionSpecialType.databaseName,
			valueType: ServiceOptionType.string
		},
		{
			name: 'userName',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: true,
			isRequired: true,
			specialValueType: ConnectionOptionSpecialType.userName,
			valueType: ServiceOptionType.string
		},
		{
			name: 'authenticationType',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: true,
			isRequired: true,
			specialValueType: ConnectionOptionSpecialType.authType,
			valueType: ServiceOptionType.string
		},
		{
			name: 'password',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: true,
			isRequired: true,
			specialValueType: ConnectionOptionSpecialType.password,
			valueType: ServiceOptionType.string
		},
		{
			name: 'encrypt',
			displayName: undefined,
			description: undefined,
			groupName: undefined,
			categoryValues: undefined,
			defaultValue: undefined,
			isIdentity: false,
			isRequired: false,
			specialValueType: undefined,
			valueType: ServiceOptionType.string
		}
	]
};

const capabilitiesService = new CapabilitiesTestService();
capabilitiesService.capabilities['MSSQL'] = { connection: sqlProvider };

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

		// no parameter - default to false
		let connections = connectionManagementService.getConnections();
		assert.equal(connections.length, 6, 'no known connections');

		// explicitly set to false
		connections = connectionManagementService.getConnections();
		assert.equal(connections.length, 6, 'no known connections');

		// active connections only
		connections = connectionManagementService.getConnections(true);
		assert.equal(connections.length, 2, 'no known connections');
	});
});

function createConnectionProfile(id: string): ConnectionProfile {

	return new ConnectionProfile(capabilitiesService, {
		connectionName: 'newName',
		savePassword: false,
		groupFullName: 'testGroup',
		serverName: 'testServerName',
		databaseName: 'testDatabaseName',
		authenticationType: 'inetgrated',
		password: 'test',
		userName: 'testUsername',
		groupId: undefined,
		providerName: 'MSSQL',
		options: {},
		saveProfile: true,
		id: id
	});
}

function createConnectionGroup(id: string): ConnectionProfileGroup {
	return new ConnectionProfileGroup(id, undefined, id, undefined, undefined);
}