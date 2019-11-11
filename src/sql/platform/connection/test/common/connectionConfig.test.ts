/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ConnectionConfig } from 'sql/platform/connection/common/connectionConfig';
import { ConnectionGroup } from 'sql/base/common/connectionGroup';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { NullLogService, ILogService } from 'vs/platform/log/common/log';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { find } from 'vs/base/common/arrays';
import { Connection } from 'sql/base/common/connection';
import { ConnectionProfile, ConnectionShape } from 'sql/base/common/connectionProfile';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';

const storedGroup1 = Object.freeze({ id: 'asdasd1', name: 'name1' });
const group1 = new ConnectionGroup(storedGroup1.name, storedGroup1.id);

const storedGroup2 = Object.freeze({ id: 'asdasd2', name: 'name2' });
const group2 = new ConnectionGroup(storedGroup2.name, storedGroup2.id);

const storedSubGroup2 = Object.freeze({ id: 'asdasdsub', name: 'name2', parentId: 'asdasd2' });
const subGroup2 = new ConnectionGroup(storedGroup2.name, storedSubGroup2.id, storedSubGroup2.parentId);

const storedConnection1 = Object.freeze({ id: 'asdasdasd1', providerName: 'MSSQL', groupId: storedGroup1.id, options: { serverName: 'server1', databaseName: 'database1', authenticationType: 'password' } });
const shape1: ConnectionShape = { serverName: 'server1', databaseName: 'database1', providerName: 'MSSQL', authenticationType: 'password' };
const profile1 = ConnectionProfile.from(shape1);
const connection1 = new Connection(profile1, undefined, storedConnection1.id, storedConnection1.groupId);

const storedConnection2 = Object.freeze({ id: 'asdasdasd2', providerName: 'MSSQL', groupId: storedGroup1.id, options: { serverName: 'server2', databaseName: 'database2', authenticationType: 'password' } });
const shape2: ConnectionShape = { serverName: 'server2', databaseName: 'database2', providerName: 'MSSQL', authenticationType: 'password' };
const profile2 = ConnectionProfile.from(shape2);
const connection2 = new Connection(profile2, undefined, storedConnection2.id, storedConnection2.groupId);

const grouplessStoredConnection1 = Object.freeze({ id: 'asdasdasd2', providerName: 'MSSQL', options: { serverName: 'server2', databaseName: 'database2', authenticationType: 'password' } });
const grouplessShape1: ConnectionShape = { serverName: 'server2', databaseName: 'database2', providerName: 'MSSQL', authenticationType: 'password' };
const grouplessProfile1 = ConnectionProfile.from(grouplessShape1);
const grouplessConnection1 = new Connection(grouplessProfile1, undefined, grouplessStoredConnection1.id);

suite('Connection Config -', () => {
	let configurationService: TestConfigurationService;
	let logService: NullLogService;
	let capabilitiesService: TestCapabilitiesService;

	setup(() => {
		configurationService = new TestConfigurationService();
		logService = new NullLogService();
		capabilitiesService = new TestCapabilitiesService();
	});

	test('gets single connection', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		configurationService.updateValue('datasource.connections', [storedConnection1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const connections = connectionConfig.connections;
		assert(connections.length === 1);
		assert(connectionsMatch(connections[0], connection1));
	});

	test('gets multiple connections', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		configurationService.updateValue('datasource.connections', [storedConnection1, storedConnection2]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const connections = connectionConfig.connections;
		assert(connections.length === 2);
		assert(connectionsMatch(find(connections, c => c.id === connection1.id), connection1));
		assert(connectionsMatch(find(connections, c => c.id === connection2.id), connection2));
	});

	test('gets single group', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;
		assert(groups.length === 1);
		assert(groupsMatch(groups[0], group1));
	});

	test('gets multiple groups', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1, storedGroup2]);
		configurationService.updateValue('datasource.connections', [storedConnection1, storedConnection2]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;
		assert(groups.length === 2);
		assert(groupsMatch(find(groups, c => c.id === group1.id), group1));
		assert(groupsMatch(find(groups, c => c.id === group2.id), group2));
	});

	test('adds connection', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		// also testing memorizing
		let connections = connectionConfig.connections;
		assert(connections.length === 0);

		await connectionConfig.addConnection(connection1);

		const storedConnections = configurationService.getValue('datasource.connections');

		assert.deepEqual(storedConnections, [storedConnection1]);

		connections = connectionConfig.connections;
		assert(connections.length === 1);
		assert(connectionsMatch(connections[0], connection1));
	});

	test('getting connection with invalid group logs error and omits the connection', () => {
		configurationService.updateValue('datasource.connections', [storedConnection1]);
		const messages: Array<string | Error> = [];
		logService = <Partial<ILogService>>{
			error: (message) => {
				messages.push(message);
			}
		} as ILogService;
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		// also testing memorizing
		let connections = connectionConfig.connections;
		assert(connections.length === 0);
		assert(messages.length === 1);
	});

	test('adds connection with existing connections', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		configurationService.updateValue('datasource.connections', [storedConnection1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		// also testing memorizing
		let connections = connectionConfig.connections;
		assert(connections.length === 1);

		await connectionConfig.addConnection(connection2);

		const storedConnectionsConfig = configurationService.inspect<{ id: string, providerName: string, groupId: string, options: { [key: string]: any } }[]>('datasource.connections');
		const storedConnections = (storedConnectionsConfig.user || []).concat(storedConnectionsConfig.workspace || []);

		// we aren't trying to verify the order so we will check each one specifically
		assert.deepEqual(find(storedConnections, c => c.id === storedConnection1.id), storedConnection1);
		assert.deepEqual(find(storedConnections, c => c.id === storedConnection2.id), storedConnection2);

		connections = connectionConfig.connections;
		assert(connections.length === 2);
		assert(connectionsMatch(find(connections, c => c.id === connection1.id), connection1));
		assert(connectionsMatch(find(connections, c => c.id === connection2.id), connection2));
	});

	test('adding an existing connection throws', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		configurationService.updateValue('datasource.connections', [storedConnection1], ConfigurationTarget.USER); // by default we add things to the user settings
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		// also testing memorizing
		let connections = connectionConfig.connections;
		assert(connections.length === 1);
		try {
			await connectionConfig.addConnection(connection1);
			assert.fail();
		} catch (e) {
			connections = connectionConfig.connections;
			assert(connections.length === 1);
		}
	});

	test('gets a connection without a group', () => {
		configurationService.updateValue('datasource.connections', [grouplessStoredConnection1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const connections = connectionConfig.connections;
		assert(connections.length === 1);
		assert(connectionsMatch(connections[0], grouplessConnection1));
	});

	test('gets a group with a parent', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup2, storedSubGroup2]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;
		assert(groups.length === 2);
		assert(groupsMatch(find(groups, c => c.id === group2.id), group2));
		assert(groupsMatch(find(groups, c => c.id === subGroup2.id), subGroup2));
	});

	test('getting a group with an invalid parent logs an error and omits with error', async () => {
		const messages: Array<string | Error> = [];
		logService = <Partial<ILogService>>{
			error: (message) => {
				messages.push(message);
			}
		} as ILogService;
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1, storedSubGroup2]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;
		assert(messages.length === 1);
		assert(groups.length === 1);
		assert(groupsMatch(groups[0], group1));
	});

	test('adds a group', async () => {
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		let groups = connectionConfig.groups;

		assert(groups.length === 0);

		await connectionConfig.addGroup(group1);

		groups = connectionConfig.groups;
		assert(groups.length === 1);
		assert(groupsMatch(groups[0], group1));

		const storedGroups = configurationService.getValue('datasource.connectionGroups');
		assert.deepEqual(storedGroups, [storedGroup1]);
	});

	test('adding a group that already exists throws', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		let groups = connectionConfig.groups;

		assert(groups.length === 1);
		try {
			await connectionConfig.addGroup(group1);
			assert.fail();
		} catch (e) {
			groups = connectionConfig.groups;
			assert(groups.length === 1);

			const storedGroups = configurationService.getValue('datasource.connectionGroups');
			assert.deepEqual(storedGroups, [storedGroup1]);
		}
	});

	test('delete a connection', async () => {
		configurationService.updateValue('datasource.connections', [grouplessStoredConnection1], ConfigurationTarget.USER);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const connections = connectionConfig.connections;

		assert(connections.length === 1);

		await connectionConfig.deleteConnection(connections[0]);

		const newConnections = connectionConfig.connections;

		assert(newConnections.length === 0);
		const storedConnections = configurationService.getValue('datasource.connections');
		assert.deepEqual(storedConnections, []);
	});

	test('deleting a connection throws an error if connection didnt come from connection config', async () => {
		configurationService.updateValue('datasource.connections', [grouplessStoredConnection1], ConfigurationTarget.USER);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		let connections = connectionConfig.connections;

		assert(connections.length === 1);

		try {
			await connectionConfig.deleteConnection(grouplessConnection1);
			assert.fail();
		} catch (e) {
			connections = connectionConfig.connections;

			assert(connections.length === 1);
		}
	});

	test('delete a group', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1], ConfigurationTarget.USER);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;

		assert(groups.length === 1);

		await connectionConfig.deleteGroup(groups[0]);

		const newGroups = connectionConfig.groups;

		assert(newGroups.length === 0);
		const storedConnections = configurationService.getValue('datasource.connectionGroups');
		assert.deepEqual(storedConnections, []);
	});

	test('deleting a group throws an error if group didnt come from connection config', async () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1], ConfigurationTarget.USER);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		let groups = connectionConfig.groups;

		assert(groups.length === 1);

		try {
			await connectionConfig.deleteGroup(group1);
			assert.fail();
		} catch (e) {
			groups = connectionConfig.groups;

			assert(groups.length === 1);
		}
	});
});

function connectionsMatch(connection1: Connection, connection2: Connection): boolean {
	return connection1.profile.matches(connection2.profile) && connection1.id === connection2.id && connection1.groupId === connection2.groupId;
}

function groupsMatch(group1: ConnectionGroup, group2: ConnectionGroup, includeChildren: boolean = false): boolean {
	if (includeChildren) {
		if (group1.children.length === group2.children.length) {
			for (const child of group1.children) {
				const child2 = find(group2.children, c => c.id === child.id);
				if (!child2) {
					return false;
				}
				if (child instanceof Connection) {
					if (!connectionsMatch(child, child2 as Connection)) {
						return false;
					}
				} else {
					if (!groupsMatch(child, child2 as ConnectionGroup, includeChildren)) {
						return false;
					}
				}
			}
		}
	}

	return group1.color === group2.color && group1.description === group2.description && group1.name === group2.name && group1.parent === group2.parent;
}
