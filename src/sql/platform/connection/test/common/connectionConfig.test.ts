/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ConnectionConfig } from 'sql/platform/connection/common/connectionConfig';
import { ConnectionGroup } from 'sql/base/common/connectionGroup';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { find } from 'vs/base/common/arrays';
import { Connection } from 'sql/base/common/connection';
import { ConnectionProfile, ConnectionShape } from 'sql/base/common/connectionProfile';

const storedGroup1 = { id: 'asdasd', name: 'name' };
const group1 = new ConnectionGroup(storedGroup1.name, storedGroup1.id);

const storedConnection1 = { id: 'asdasdasd', providerName: 'mssql', groupId: storedGroup1.id };
const shape1: ConnectionShape = { serverName: 'server1', databaseName: 'database1', providerName: 'mssql', authenticationType: 'password' };
const profile1 = ConnectionProfile.from(shape1);
const connection1 = new Connection(profile1, undefined, storedConnection1.id, storedConnection1.groupId);

suite('Connection Config', () => {
	let configurationService: TestConfigurationService;
	let logService: NullLogService;
	let capabilitiesService: TestCapabilitiesService;

	setup(() => {
		configurationService = new TestConfigurationService();
		logService = new NullLogService();
		capabilitiesService = new TestCapabilitiesService();
	});

	test('gets connections', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		configurationService.updateValue('datasource.connections', [storedConnection1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const connections = connectionConfig.connections;
		assert(connections.length === 1);
		const connection = connections[0];
		assert(connectionsMatch(connection, connection1));
	});

	test('gets groups', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;
		assert(groups.length === 1);
		const group = groups[0];
		assert(groupsMatch(group, group1));
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
