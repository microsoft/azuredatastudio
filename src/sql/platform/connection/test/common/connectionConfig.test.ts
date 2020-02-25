/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import { ProviderFeatures } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionConfig, ISaveGroupResult } from 'sql/platform/connection/common/connectionConfig';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IConnectionProfile, IConnectionProfileStore, ConnectionOptionSpecialType, ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import * as TypeMoq from 'typemoq';
import { Emitter } from 'vs/base/common/event';
import { deepClone, deepFreeze } from 'vs/base/common/objects';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { find } from 'vs/base/common/arrays';

suite('ConnectionConfig', () => {
	let capabilitiesService: TypeMoq.Mock<TestCapabilitiesService>;
	let msSQLCapabilities: ProviderFeatures;
	let capabilities: ProviderFeatures[];
	let onCapabilitiesRegistered = new Emitter<ProviderFeatures>();

	const testGroups = deepFreeze([
		{
			name: 'g1',
			id: 'g1',
			parentId: 'ROOT',
			color: 'pink',
			description: 'g1'
		},
		{
			name: 'g1-1',
			id: 'g1-1',
			parentId: 'g1',
			color: 'blue',
			description: 'g1-1'
		},
		{
			name: 'ROOT',
			id: 'ROOT',
			parentId: '',
			color: 'white',
			description: 'ROOT'
		},
		{
			name: 'g2',
			id: 'g2',
			parentId: 'ROOT',
			color: 'green',
			description: 'g2'
		},
		{
			name: 'g2-1',
			id: 'g2-1',
			parentId: 'g2',
			color: 'yellow',
			description: 'g2'
		},
		{
			name: 'g3',
			id: 'g3',
			parentId: '',
			color: 'orange',
			description: 'g3'
		},
		{
			name: 'g3-1',
			id: 'g3-1',
			parentId: 'g3',
			color: 'purple',
			description: 'g3-1'
		}
	]);

	const testConnections: IConnectionProfileStore[] = deepFreeze([
		{
			options: {
				serverName: 'server1',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: ''
			},
			providerName: 'MSSQL',
			groupId: 'test',
			savePassword: true,
			id: 'server1'
		},
		{
			options: {
				serverName: 'server2',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: ''
			},
			providerName: 'MSSQL',
			groupId: 'test',
			savePassword: true,
			id: 'server2'
		},
		{
			options: {
				serverName: 'server3',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: ''
			},
			providerName: 'MSSQL',
			groupId: 'g3',
			savePassword: true,
			id: 'server3'
		}
	]);

	setup(() => {
		capabilitiesService = TypeMoq.Mock.ofType(TestCapabilitiesService);
		capabilities = [];
		let connectionProvider: azdata.ConnectionProviderOptions = {
			options: [
				{
					name: 'serverName',
					displayName: undefined!,
					description: undefined!,
					groupName: undefined!,
					categoryValues: undefined!,
					defaultValue: undefined!,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.serverName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'databaseName',
					displayName: undefined!,
					description: undefined!,
					groupName: undefined!,
					categoryValues: undefined!,
					defaultValue: undefined!,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.databaseName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'userName',
					displayName: undefined!,
					description: undefined!,
					groupName: undefined!,
					categoryValues: undefined!,
					defaultValue: undefined!,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.userName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'authenticationType',
					displayName: undefined!,
					description: undefined!,
					groupName: undefined!,
					categoryValues: undefined!,
					defaultValue: undefined!,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.authType,
					valueType: ServiceOptionType.string
				},
				{
					name: 'password',
					displayName: undefined!,
					description: undefined!,
					groupName: undefined!,
					categoryValues: undefined!,
					defaultValue: undefined!,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.password,
					valueType: ServiceOptionType.string
				}
			]
		};
		msSQLCapabilities = {
			connection: {
				providerId: 'MSSQL',
				displayName: 'MSSQL',
				connectionOptions: connectionProvider.options
			}
		};
		capabilities.push(msSQLCapabilities);

		capabilitiesService.setup(x => x.getCapabilities('MSSQL')).returns(() => msSQLCapabilities);
		(capabilitiesService.object as any).onCapabilitiesRegistered = onCapabilitiesRegistered.event;
	});

	function groupsAreEqual(groups1: IConnectionProfileGroup[], groups2: IConnectionProfileGroup[]): boolean {
		if (!groups1 && !groups2) {
			return true;
		} else if ((!groups1 && groups2 && groups2.length === 0) || (!groups2 && groups1 && groups1.length === 0)) {
			return true;
		}

		if (groups1.length !== groups2.length) {
			return false;
		}

		for (let group of groups1) {
			let g2 = find(groups2, g => g.name === group.name);
			// if we couldn't find the group it means they must not be equal
			if (!g2) {
				return false;
			}

			// weird way to verify that each group appears the same number of times in each array
			let result = groupsAreEqual(groups1.filter(a => a.parentId === group.id), groups2.filter(b => b.parentId === g2!.id));
			if (!result) {
				return false;
			}

		}

		return true;
	}

	test('getAllGroups should merge user and workspace settings correctly', () => {
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups).slice(0, 3), ConfigurationTarget.USER);
		// we intentionally overlap these values with the expectation that the function to should return each group once
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups).slice(2, testGroups.length), ConfigurationTarget.WORKSPACE);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		let allGroups = config.getAllGroups();

		assert.equal(allGroups.length, testGroups.length, 'did not meet the expected length');
		assert.ok(groupsAreEqual(allGroups, testGroups), 'the groups returned did not match expectation');
	});

	test('addConnection should add the new profile to user settings', async () => {
		let newProfile: IConnectionProfile = {
			serverName: 'new server',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: undefined,
			groupId: undefined,
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);
		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		connectionProfile.options['databaseDisplayName'] = 'database';
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		let savedConnectionProfile = await config.addConnection(connectionProfile);

		assert.ok(!!savedConnectionProfile.id);
		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!.length, testConnections.length + 1);
	});

	test('addConnection should not add the new profile to user settings if already exists', async () => {
		let existingConnection = testConnections[0];
		let newProfile: IConnectionProfile = {
			serverName: existingConnection.options['serverName'],
			databaseName: existingConnection.options['databaseName'],
			userName: existingConnection.options['userName'],
			password: existingConnection.options['password'],
			authenticationType: existingConnection.options['authenticationType'],
			groupId: existingConnection.groupId,
			savePassword: true,
			groupFullName: undefined,
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		connectionProfile.options['databaseDisplayName'] = existingConnection.options['databaseName'];

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		let savedConnectionProfile = await config.addConnection(connectionProfile);

		assert.equal(savedConnectionProfile.id, existingConnection.id);
		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!.length, testConnections.length);
	});

	test('addConnection should add the new group to user settings if does not exist', async () => {
		let newProfile: IConnectionProfile = {
			serverName: 'new server',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g2/g2-2',
			groupId: undefined,
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.addConnection(connectionProfile);

		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!.length, testConnections.length + 1);
		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connectionGroups').userValue!.length, testGroups.length + 1);
	});

	test('getConnections should return connections from user and workspace settings given getWorkspaceConnections set to true', () => {
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections).slice(0, 1), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', deepClone(testConnections).slice(1, testConnections.length), ConfigurationTarget.WORKSPACE);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		let allConnections = config.getConnections(true);
		assert.equal(allConnections.length, testConnections.length);
	});

	test('getConnections should return connections from user settings given getWorkspaceConnections set to false', () => {
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections).slice(0, 2), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', deepClone(testConnections).slice(2, testConnections.length), ConfigurationTarget.WORKSPACE);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		let allConnections = config.getConnections(false);
		assert.equal(allConnections.length, 2);
	});

	test('getConnections should return connections with a valid id', () => {
		let workspaceConnections = deepClone(testConnections).map(c => {
			c.id = c.options['serverName'];
			return c;
		});
		let userConnections = deepClone(testConnections).map(c => {
			c.id = undefined!;
			return c;
		});
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', userConnections, ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', workspaceConnections, ConfigurationTarget.WORKSPACE);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		let allConnections = config.getConnections(false);
		assert.equal(allConnections.length, testConnections.length);
		allConnections.forEach(connection => {
			let userConnection = find(testConnections, u => u.options['serverName'] === connection.serverName);
			if (userConnection !== undefined) {
				assert.notEqual(connection.id, connection.getOptionsKey());
				assert.ok(!!connection.id);
			} else {
				let workspaceConnection = find(workspaceConnections, u => u.options['serverName'] === connection.serverName);
				assert.notEqual(connection.id, connection.getOptionsKey());
				assert.equal(workspaceConnection!.id, connection.id);
			}
		});
	});

	test('saveGroup should save the new groups to tree and return the id of the last group name', () => {
		let config = new ConnectionConfig(undefined!, undefined!);
		let groups: IConnectionProfileGroup[] = deepClone(testGroups);
		let newGroups: string = 'ROOT/g1/g1-1/new-group/new-group2';
		let color: string = 'red';

		let result: ISaveGroupResult = config.saveGroup(groups, newGroups, color, newGroups);
		assert.ok(!!result);
		assert.equal(result.groups.length, testGroups.length + 2, 'The result groups length is invalid');
		let newGroup = find(result.groups, g => g.name === 'new-group2');
		assert.equal(result.newGroupId, newGroup!.id, 'The groups id is invalid');
	});

	test('saveGroup should only add the groups that are not in the tree', () => {
		let config = new ConnectionConfig(undefined!, undefined!);
		let groups: IConnectionProfileGroup[] = deepClone(testGroups);
		let newGroups: string = 'ROOT/g2/g2-5';
		let color: string = 'red';

		let result: ISaveGroupResult = config.saveGroup(groups, newGroups, color, newGroups);
		assert.ok(!!result);
		assert.equal(result.groups.length, testGroups.length + 1, 'The result groups length is invalid');
		let newGroup = find(result.groups, g => g.name === 'g2-5');
		assert.equal(result.newGroupId, newGroup!.id, 'The groups id is invalid');
	});

	test('saveGroup should not add any new group if tree already has all the groups in the full path', () => {
		let config = new ConnectionConfig(undefined!, undefined!);
		let groups: IConnectionProfileGroup[] = deepClone(testGroups);
		let newGroups: string = 'ROOT/g2/g2-1';
		let color: string = 'red';

		let result: ISaveGroupResult = config.saveGroup(groups, newGroups, color, newGroups);
		assert.ok(!!result);
		assert.equal(result.groups.length, testGroups.length, 'The result groups length is invalid');
		let newGroup = find(result.groups, g => g.name === 'g2-1');
		assert.equal(result.newGroupId, newGroup!.id, 'The groups id is invalid');
	});

	test('deleteConnection should remove the connection from config', async () => {
		let newProfile: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3',
			groupId: 'g3',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		connectionProfile.options['databaseDisplayName'] = 'database';

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.deleteConnection(connectionProfile);

		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!.length, testConnections.length - 1);
	});

	test('deleteConnectionGroup should remove the children connections and subgroups from config', async () => {
		let newProfile: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3',
			groupId: 'g3',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		connectionProfile.options['databaseDisplayName'] = 'database';

		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
		let childGroup = new ConnectionProfileGroup('g3-1', connectionProfileGroup, 'g3-1', undefined, undefined);
		connectionProfileGroup.addGroups([childGroup]);
		connectionProfileGroup.addConnections([connectionProfile]);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.deleteGroup(connectionProfileGroup);

		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!.length, testConnections.length - 1);
		assert.equal(configurationService.inspect<IConnectionProfileGroup[]>('datasource.connectionGroups').userValue!.length, testGroups.length - 2);
	});

	test('deleteConnection should not throw error for connection not in config', async () => {
		let newProfile: IConnectionProfile = {
			serverName: 'connectionNotThere',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3',
			groupId: 'newid',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.deleteConnection(connectionProfile);

		assert.equal(configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!.length, testConnections.length);
	});

	test('renameGroup should change group name', async () => {
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);

		let connectionProfileGroup = new ConnectionProfileGroup('g-renamed', undefined, 'g2', undefined, undefined);
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.editGroup(connectionProfileGroup);

		let editedGroups = configurationService.inspect<IConnectionProfileGroup[]>('datasource.connectionGroups').userValue!;

		assert.equal(editedGroups.length, testGroups.length);
		let editedGroup = find(editedGroups, group => group.id === 'g2');
		assert.ok(!!editedGroup);
		assert.equal(editedGroup!.name, 'g-renamed');
	});

	test('edit group should throw if there is a confliction', async () => {
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);

		let sameNameGroup = new ConnectionProfileGroup('g3', undefined, 'g2', undefined, undefined);
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);

		try {
			await config.editGroup(sameNameGroup);
			assert.fail();
		} catch (e) {
			let groups = configurationService.inspect<IConnectionProfileGroup[]>('datasource.connectionGroups').userValue!;
			let originalGroup = find(groups, g => g.id === 'g2');
			assert.ok(!!originalGroup);
			assert.equal(originalGroup!.name, 'g2');
		}
	});

	test('change group(parent) for connection group', async () => {
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);

		let sourceProfileGroup = new ConnectionProfileGroup('g2', undefined, 'g2', undefined, undefined);
		let targetProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.changeGroupIdForConnectionGroup(sourceProfileGroup, targetProfileGroup);

		let editedGroups = configurationService.inspect<IConnectionProfileGroup[]>('datasource.connectionGroups').userValue!;

		assert.equal(editedGroups.length, testGroups.length);
		let editedGroup = find(editedGroups, group => group.id === 'g2');
		assert.ok(!!editedGroup);
		assert.equal(editedGroup!.parentId, 'g3');
	});


	test('change group for connection with conflict should throw', async () => {
		let changingProfile: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3',
			groupId: 'g3',
			getOptionsKey: () => { return 'connectionId'; },
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: 'server3-2',
			connectionName: undefined!
		};
		let existingProfile = ConnectionProfile.convertToProfileStore(capabilitiesService.object, {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'test',
			groupId: 'test',
			getOptionsKey: () => { return 'connectionId'; },
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: 'server3',
			connectionName: undefined!
		});

		let _testConnections = [...deepClone(testConnections), existingProfile, changingProfile];

		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', _testConnections, ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, changingProfile);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		try {
			await config.changeGroupIdForConnection(connectionProfile, 'test');
			assert.fail();
		} catch (e) {
			let editedConnections = configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!;
			// two
			assert.equal(editedConnections.length, _testConnections.length);
			let editedConnection = find(editedConnections, con => con.id === 'server3-2');
			assert.ok(!!editedConnection);
			assert.equal(editedConnection!.groupId, 'g3');
		}
	});

	test('change group(parent) for connection', async () => {
		let newProfile: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3',
			groupId: 'g3',
			getOptionsKey: () => { return 'connectionId'; },
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: 'server3',
			connectionName: undefined!
		};

		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);

		let connectionProfile = new ConnectionProfile(capabilitiesService.object, newProfile);
		let newId = 'newid';

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);
		await config.changeGroupIdForConnection(connectionProfile, newId);

		let editedConnections = configurationService.inspect<IConnectionProfileStore[]>('datasource.connections').userValue!;
		assert.equal(editedConnections.length, testConnections.length);
		let editedConnection = find(editedConnections, con => con.id === 'server3');
		assert.ok(!!editedConnection);
		assert.equal(editedConnection!.groupId, 'newid');
	});

	test('addConnection should not move the connection when editing', async () => {
		// Set up the connection config
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connections', deepClone(testConnections), ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);
		let config = new ConnectionConfig(configurationService, capabilitiesService.object);

		// Clone a connection and modify an option
		const connectionIndex = 1;
		const optionKey = 'testOption';
		const optionValue = 'testValue';
		let allConnections = config.getConnections(false);
		let oldLength = allConnections.length;
		let connectionToEdit = allConnections[connectionIndex].clone();
		connectionToEdit.options[optionKey] = optionValue;
		await config.addConnection(connectionToEdit);

		// Get the connection and verify that it is in the same place and has been updated
		let newConnections = config.getConnections(false);
		assert.equal(newConnections.length, oldLength);
		let editedConnection = newConnections[connectionIndex];
		assert.equal(editedConnection.getOptionsKey(), connectionToEdit.getOptionsKey());
		assert.equal(editedConnection.options[optionKey], optionValue);
	});

	test('addgroup works', async () => {
		let newGroup: IConnectionProfileGroup = {
			id: undefined!,
			parentId: undefined,
			name: 'new group',
			color: 'red',
			description: 'new group'
		};
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);

		let config = new ConnectionConfig(configurationService, capabilitiesService.object);

		await config.addGroup(newGroup);

		let editGroups = configurationService.inspect<IConnectionProfileGroup[]>('datasource.connectionGroups').userValue!;

		assert.equal(editGroups.length, testGroups.length + 1);
	});

	test('addGroup rejects if group name already exists', async () => {
		let existingGroupName: IConnectionProfileGroup = {
			id: undefined!,
			parentId: undefined,
			name: 'g2',
			color: 'red',
			description: 'new group'
		};
		let configurationService = new TestConfigurationService();
		configurationService.updateValue('datasource.connectionGroups', deepClone(testGroups), ConfigurationTarget.USER);

		const config = new ConnectionConfig(configurationService, capabilitiesService.object);
		try {
			await config.addGroup(existingGroupName);
			assert.fail();
		} catch (e) {
			let editGroups = configurationService.inspect<IConnectionProfileGroup[]>('datasource.connectionGroups').userValue!;

			assert.equal(editGroups.length, testGroups.length);
		}
	});
});
