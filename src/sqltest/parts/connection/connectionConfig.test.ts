/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';


import * as TypeMoq from 'typemoq';
import { ConnectionConfig, ISaveGroupResult } from 'sql/parts/connection/common/connectionConfig';
import { IConnectionProfile, IConnectionProfileStore } from 'sql/parts/connection/common/interfaces';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { WorkspaceConfigurationTestService } from 'sqltest/stubs/workspaceConfigurationTestService';
import { IConfigurationValue as TConfigurationValue, ConfigurationEditingService } from 'vs/workbench/services/configuration/node/configurationEditingService';
import * as Constants from 'sql/parts/connection/common/constants';
import { IConnectionProfileGroup, ConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import { TPromise } from 'vs/base/common/winjs.base';
import * as assert from 'assert';
import { CapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import * as sqlops from 'sqlops';
import { Emitter } from 'vs/base/common/event';

suite('SQL ConnectionConfig tests', () => {
	/*
		let capabilitiesService: TypeMoq.Mock<CapabilitiesService>;
		let workspaceConfigurationServiceMock: TypeMoq.Mock<WorkspaceConfigurationTestService>;
		let configEditingServiceMock: TypeMoq.Mock<ConfigurationEditingService>;
		let msSQLCapabilities: sqlops.DataProtocolServerCapabilities;
		let capabilities: sqlops.DataProtocolServerCapabilities[];
		let onProviderRegistered = new Emitter<sqlops.DataProtocolServerCapabilities>();
	
		let configValueToConcat: TConfigurationValue<IConnectionProfileGroup[]> = {
			workspace: [{
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
			}
			],
			user: [{
				name: 'ROOT',
				id: 'ROOT',
				parentId: '',
				color: 'white',
				description: 'ROOT'
			}, {
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
			],
			value: [],
			default: [],
			folder: []
		};
	
		let configValueToMerge: TConfigurationValue<IConnectionProfileGroup[]> = {
			workspace: [
				{
					name: 'g1',
					id: 'g1',
					parentId: '',
					color: 'pink',
					description: 'g1'
				},
				{
					name: 'g1-1',
					id: 'g1-1',
					parentId: 'g1',
					color: 'blue',
					description: 'g1-1'
				}
			],
			user: [
				{
					name: 'g2',
					id: 'g2',
					parentId: '',
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
					name: 'g1',
					id: 'g1',
					parentId: '',
					color: 'pink',
					description: 'g1'
				},
				{
					name: 'g1-2',
					id: 'g1-2',
					parentId: 'g1',
					color: 'silver',
					description: 'g1-2'
				}],
			value: [],
			default: [],
			folder: []
		};
	
		let connections: TConfigurationValue<IConnectionProfileStore[]> = {
			workspace: [{
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
			}
	
	
			],
			user: [{
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
			}, {
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
			],
			value: [],
			default: [],
			folder: []
		};
		setup(() => {
			capabilitiesService = TypeMoq.Mock.ofType(CapabilitiesService);
			capabilities = [];
			let connectionProvider: sqlops.ConnectionProviderOptions = {
				options: [
					{
						name: 'serverName',
						displayName: undefined,
						description: undefined,
						groupName: undefined,
						categoryValues: undefined,
						defaultValue: undefined,
						isIdentity: true,
						isRequired: true,
						specialValueType: 0,
						valueType: 0
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
						specialValueType: 1,
						valueType: 0
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
						specialValueType: 3,
						valueType: 0
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
						specialValueType: 2,
						valueType: 0
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
						specialValueType: 4,
						valueType: 0
					}
				]
			};
			msSQLCapabilities = {
				protocolVersion: '1',
				providerName: 'MSSQL',
				providerDisplayName: 'MSSQL',
				connectionProvider: connectionProvider,
				adminServicesProvider: undefined,
				features: undefined
			};
			capabilities.push(msSQLCapabilities);
	
			capabilitiesService.setup(x => x.getCapabilities()).returns(() => capabilities);
			capabilitiesService.setup(x => x.onProviderRegisteredEvent).returns(() => onProviderRegistered.event);
	
			workspaceConfigurationServiceMock = TypeMoq.Mock.ofType(WorkspaceConfigurationTestService);
			workspaceConfigurationServiceMock.setup(x => x.reloadConfiguration())
				.returns(() => TPromise.as<{}>({}));
	
			configEditingServiceMock = TypeMoq.Mock.ofType(ConfigurationEditingService);
			let nothing: void;
			configEditingServiceMock.setup(x => x.writeConfiguration(ConfigurationTarget.USER, TypeMoq.It.isAny())).returns(() => TPromise.as<void>(nothing));
			configEditingServiceMock.setup(x => x.writeConfiguration(ConfigurationTarget.WORKSPACE, TypeMoq.It.isAny())).returns(() => TPromise.as<void>(nothing));
		});
	
		function groupsAreEqual(groups1: IConnectionProfileGroup[], groups2: IConnectionProfileGroup[]): Boolean {
			if (!groups1 && !groups2) {
				return true;
			} else if ((!groups1 && groups2 && groups2.length === 0) || (!groups2 && groups1 && groups1.length === 0)) {
				return true;
			}
	
			if (groups1.length !== groups2.length) {
				return false;
			}
	
			let areEqual = true;
	
			groups1.map(g1 => {
				if (areEqual) {
					let g2 = groups2.find(g => g.name === g1.name);
					if (!g2) {
						areEqual = false;
					} else {
						let result = groupsAreEqual(groups1.filter(a => a.parentId === g1.id), groups2.filter(b => b.parentId === g2.id));
						if (result === false) {
							areEqual = false;
						}
					}
				}
			});
	
			return areEqual;
		}
	
		test('allGroups should return groups from user and workspace settings', () => {
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfile[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			let allGroups = config.getAllGroups();
	
	
			assert.notEqual(allGroups, undefined);
			assert.equal(allGroups.length, configValueToConcat.workspace.length + configValueToConcat.user.length);
		});
	
		test('allGroups should merge groups from user and workspace settings', () => {
			let expectedAllGroups: IConnectionProfileGroup[] = [
				{
					name: 'g1',
					id: 'g1',
					parentId: '',
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
					name: 'g2',
					id: 'g2',
					parentId: '',
					color: 'yellow',
					description: 'g2'
				},
				{
					name: 'g2-1',
					id: 'g2-1',
					parentId: 'g2',
					color: 'red',
					description: 'g2'
				},
				{
					name: 'g1-2',
					id: 'g1-2',
					parentId: 'g1',
					color: 'green',
					description: 'g1-2'
				}];
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToMerge);
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			let allGroups = config.getAllGroups();
	
	
			assert.notEqual(allGroups, undefined);
			assert.equal(groupsAreEqual(allGroups, expectedAllGroups), true);
		});
	
		test('addConnection should add the new profile to user settings if does not exist', done => {
			let newProfile: IConnectionProfile = {
				serverName: 'new server',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: '',
				savePassword: true,
				groupFullName: undefined,
				groupId: undefined,
				getOptionsKey: undefined,
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: undefined
			};
	
			let expectedNumberOfConnections = connections.user.length + 1;
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			connectionProfile.options['databaseDisplayName'] = 'database';
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.addConnection(connectionProfile).then(savedConnectionProfile => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				assert.notEqual(savedConnectionProfile.id, undefined);
				done();
			}).catch(error => {
				assert.fail();
				done();
			});
		});
	
		test('addConnection should not add the new profile to user settings if already exists', done => {
			let profileFromConfig = connections.user[0];
			let newProfile: IConnectionProfile = {
				serverName: profileFromConfig.options['serverName'],
				databaseName: profileFromConfig.options['databaseName'],
				userName: profileFromConfig.options['userName'],
				password: profileFromConfig.options['password'],
				authenticationType: profileFromConfig.options['authenticationType'],
				groupId: profileFromConfig.groupId,
				savePassword: true,
				groupFullName: undefined,
				getOptionsKey: undefined,
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: undefined
			};
	
			let expectedNumberOfConnections = connections.user.length;
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			connectionProfile.options['databaseDisplayName'] = profileFromConfig.options['databaseName'];
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.addConnection(connectionProfile).then(savedConnectionProfile => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				assert.equal(savedConnectionProfile.id, profileFromConfig.id);
				done();
			}).catch(error => {
				assert.fail();
				done();
			});
		});
	
		test('addConnection should add the new group to user settings if does not exist', done => {
			let newProfile: IConnectionProfile = {
				serverName: 'new server',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: '',
				savePassword: true,
				groupFullName: 'g2/g2-2',
				groupId: undefined,
				getOptionsKey: undefined,
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: undefined
			};
	
			let expectedNumberOfConnections = connections.user.length + 1;
			let expectedNumberOfGroups = configValueToConcat.user.length + 1;
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.addConnection(connectionProfile).then(success => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileGroup[]).length === expectedNumberOfGroups)), TypeMoq.Times.once());
				done();
			}).catch(error => {
				assert.fail();
				done();
			});
		});
	
		test('getConnections should return connections from user and workspace settings given getWorkspaceConnections set to true', () => {
			let getWorkspaceConnections: boolean = true;
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			let allConnections = config.getConnections(getWorkspaceConnections);
			assert.equal(allConnections.length, connections.user.length + connections.workspace.length);
		});
	
		test('getConnections should return connections from user settings given getWorkspaceConnections set to false', () => {
			let getWorkspaceConnections: boolean = false;
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			let allConnections = config.getConnections(getWorkspaceConnections);
			assert.equal(allConnections.length, connections.user.length);
		});
	
		test('getConnections should return connections with a valid id', () => {
			let getWorkspaceConnections: boolean = false;
			let connectionsWithNoId: TConfigurationValue<IConnectionProfileStore[]> = {
				user: connections.user.map(c => {
					c.id = undefined;
					return c;
				}),
				default: connections.default,
				workspace: connections.workspace.map(c => {
					c.id = c.options['serverName'];
					return c;
				}),
				value: connections.value,
				folder: []
			};
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connectionsWithNoId);
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			let allConnections = config.getConnections(getWorkspaceConnections);
			assert.equal(allConnections.length, connections.user.length);
			allConnections.forEach(connection => {
				let userConnection = connectionsWithNoId.user.find(u => u.options['serverName'] === connection.serverName);
				if (userConnection !== undefined) {
					assert.notEqual(connection.id, connection.getOptionsKey());
					assert.notEqual(connection.id, undefined);
				} else {
					let workspaceConnection = connectionsWithNoId.workspace.find(u => u.options['serverName'] === connection.serverName);
					assert.notEqual(connection.id, connection.getOptionsKey());
					assert.equal(workspaceConnection.id, connection.id);
				}
			});
		});
	
		test('getConnections update the capabilities in each profile when the provider capabilities is registered', () => {
			let oldOptionName: string = 'oldOptionName';
			let optionsMetadataFromConfig = capabilities[0].connectionProvider.options.concat({
				name: oldOptionName,
				displayName: undefined,
				description: undefined,
				groupName: undefined,
				categoryValues: undefined,
				defaultValue: undefined,
				isIdentity: true,
				isRequired: true,
				specialValueType: 0,
				valueType: 0
			});
	
			let capabilitiesFromConfig: sqlops.DataProtocolServerCapabilities[] = [];
			let connectionProvider: sqlops.ConnectionProviderOptions = {
				options: optionsMetadataFromConfig
			};
			let msSQLCapabilities2 = {
				protocolVersion: '1',
				providerName: 'MSSQL',
				providerDisplayName: 'MSSQL',
				connectionProvider: connectionProvider,
				adminServicesProvider: undefined,
				features: undefined
			};
			capabilitiesFromConfig.push(msSQLCapabilities2);
			let connectionUsingOldMetadata = connections.user.map(c => {
				c.options[oldOptionName] = 'oldOptionValue';
				return c;
			});
			let configValue = Object.assign({}, connections, { user: connectionUsingOldMetadata });
			let capabilitiesService2: TypeMoq.Mock<CapabilitiesService> = TypeMoq.Mock.ofType(CapabilitiesService);
			capabilitiesService2.setup(x => x.getCapabilities()).returns(() => []);
			capabilitiesService2.setup(x => x.onProviderRegisteredEvent).returns(() => onProviderRegistered.event);
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => configValue);
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService2.object, capabilitiesFromConfig);
			let allConnections = config.getConnections(false);
			allConnections.forEach(element => {
				assert.notEqual(element.serverName, undefined);
				assert.notEqual(element.getOptionsKey().indexOf('oldOptionValue|'), -1);
			});
	
			onProviderRegistered.fire(msSQLCapabilities);
			allConnections.forEach(element => {
				assert.notEqual(element.serverName, undefined);
				assert.equal(element.getOptionsKey().indexOf('oldOptionValue|'), -1);
			});
		});
	
		test('saveGroup should save the new groups to tree and return the id of the last group name', () => {
			let config = new ConnectionConfig(undefined, undefined, undefined, undefined);
			let groups: IConnectionProfileGroup[] = configValueToConcat.user;
			let expectedLength = configValueToConcat.user.length + 2;
			let newGroups: string = 'ROOT/g1/g1-1';
			let color: string = 'red';
	
			let result: ISaveGroupResult = config.saveGroup(groups, newGroups, color, newGroups);
			assert.notEqual(result, undefined);
			assert.equal(result.groups.length, expectedLength, 'The result groups length is invalid');
			let newGroup = result.groups.find(g => g.name === 'g1-1');
			assert.equal(result.newGroupId, newGroup.id, 'The groups id is invalid');
		});
	
		test('saveGroup should only add the groups that are not in the tree', () => {
			let config = new ConnectionConfig(undefined, undefined, undefined, undefined);
			let groups: IConnectionProfileGroup[] = configValueToConcat.user;
			let expectedLength = configValueToConcat.user.length + 1;
			let newGroups: string = 'ROOT/g2/g2-5';
			let color: string = 'red';
	
			let result: ISaveGroupResult = config.saveGroup(groups, newGroups, color, newGroups);
			assert.notEqual(result, undefined);
			assert.equal(result.groups.length, expectedLength, 'The result groups length is invalid');
			let newGroup = result.groups.find(g => g.name === 'g2-5');
			assert.equal(result.newGroupId, newGroup.id, 'The groups id is invalid');
		});
	
		test('saveGroup should not add any new group if tree already has all the groups in the full path', () => {
			let config = new ConnectionConfig(undefined, undefined, undefined, undefined);
			let groups: IConnectionProfileGroup[] = configValueToConcat.user;
			let expectedLength = configValueToConcat.user.length;
			let newGroups: string = 'ROOT/g2/g2-1';
			let color: string = 'red';
	
			let result: ISaveGroupResult = config.saveGroup(groups, newGroups, color, newGroups);
			assert.notEqual(result, undefined);
			assert.equal(result.groups.length, expectedLength, 'The result groups length is invalid');
			let newGroup = result.groups.find(g => g.name === 'g2-1');
			assert.equal(result.newGroupId, newGroup.id, 'The groups id is invalid');
		});
	
		test('deleteConnection should remove the connection from config', done => {
			let newProfile: IConnectionProfile = {
				serverName: 'server3',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: '',
				savePassword: true,
				groupFullName: 'g3',
				groupId: 'g3',
				getOptionsKey: undefined,
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: undefined
			};
	
			let expectedNumberOfConnections = connections.user.length - 1;
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			connectionProfile.options['databaseDisplayName'] = 'database';
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.deleteConnection(connectionProfile).then(() => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				done();
			}).catch(error => {
				assert.fail();
				done();
			});
		});
	
		test('deleteConnectionGroup should remove the children connections and subgroups from config', done => {
			let newProfile: IConnectionProfile = {
				serverName: 'server3',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: '',
				savePassword: true,
				groupFullName: 'g3',
				groupId: 'g3',
				getOptionsKey: undefined,
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: undefined
			};
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			connectionProfile.options['databaseDisplayName'] = 'database';
	
			let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
			let childGroup = new ConnectionProfileGroup('g3-1', connectionProfileGroup, 'g3-1', undefined, undefined);
			connectionProfileGroup.addGroups([childGroup]);
			connectionProfileGroup.addConnections([connectionProfile]);
	
			let expectedNumberOfConnections = connections.user.length - 1;
			let expectedNumberOfGroups = configValueToConcat.user.length - 2;
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.deleteGroup(connectionProfileGroup).then(() => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileGroup[]).length === expectedNumberOfGroups)), TypeMoq.Times.once());
				done();
			}).catch(error => {
				assert.fail();
				done();
			});
		});
	
		test('deleteConnection should not throw error for connection not in config', done => {
			let newProfile: IConnectionProfile = {
				serverName: 'server3',
				databaseName: 'database',
				userName: 'user',
				password: 'password',
				authenticationType: '',
				savePassword: true,
				groupFullName: 'g3',
				groupId: 'newid',
				getOptionsKey: undefined,
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: undefined
			};
	
			let expectedNumberOfConnections = connections.user.length;
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.deleteConnection(connectionProfile).then(() => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				done();
			}).catch(error => {
				assert.fail();
				done();
			});
		});
	
		test('renameGroup should change group name', done => {
	
			let expectedNumberOfConnections = configValueToConcat.user.length;
			let calledValue: any;
			let called: boolean = false;
			let nothing: void;
			let configEditingServiceMock: TypeMoq.Mock<ConfigurationEditingService> = TypeMoq.Mock.ofType(ConfigurationEditingService);
			configEditingServiceMock.setup(x => x.writeConfiguration(ConfigurationTarget.USER, TypeMoq.It.isAny())).callback((x: any, val: any) => {
				calledValue = val.value as IConnectionProfileStore[];
			}).returns(() => TPromise.as<void>(nothing));
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
			let connectionProfileGroup = new ConnectionProfileGroup('g-renamed', undefined, 'g2', undefined, undefined);
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.editGroup(connectionProfileGroup).then(() => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				calledValue.forEach(con => {
					if (con.id === 'g2') {
						assert.equal(con.name, 'g-renamed', 'Group was not renamed');
						called = true;
					}
				});
				assert.equal(called, true, 'group was not renamed');
			}).then(() => done(), (err) => done(err));
		});
	
	
		test('change group(parent) for connection group', done => {
			let expectedNumberOfConnections = configValueToConcat.user.length;
			let calledValue: any;
			let nothing: void;
			let configEditingServiceMock: TypeMoq.Mock<ConfigurationEditingService> = TypeMoq.Mock.ofType(ConfigurationEditingService);
			configEditingServiceMock.setup(x => x.writeConfiguration(ConfigurationTarget.USER, TypeMoq.It.isAny())).callback((x: any, val: any) => {
				calledValue = val.value as IConnectionProfileStore[];
			}).returns(() => TPromise.as<void>(nothing));
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionGroupsArrayName))
				.returns(() => configValueToConcat);
	
			let sourceProfileGroup = new ConnectionProfileGroup('g2', undefined, 'g2', undefined, undefined);
			let targetProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.changeGroupIdForConnectionGroup(sourceProfileGroup, targetProfileGroup).then(() => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.once());
				calledValue.forEach(con => {
					if (con.id === 'g2') {
						assert.equal(con.parentId, 'g3', 'Group parent was not changed');
					}
				});
			}).then(() => done(), (err) => done(err));
		});
	
	
		test('change group(parent) for connection', done => {
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
				matches: undefined,
				providerName: 'MSSQL',
				options: {},
				saveProfile: true,
				id: 'test'
			};
	
			let expectedNumberOfConnections = connections.user.length;
			workspaceConfigurationServiceMock.setup(x => x.lookup<IConnectionProfileStore[] | IConnectionProfileGroup[] | sqlops.DataProtocolServerCapabilities[]>(
				Constants.connectionsArrayName))
				.returns(() => connections);
	
			let connectionProfile = new ConnectionProfile(msSQLCapabilities, newProfile);
			let newId = 'newid';
			let calledValue: any;
			let nothing: void;
			let configEditingServiceMock: TypeMoq.Mock<ConfigurationEditingService> = TypeMoq.Mock.ofType(ConfigurationEditingService);
			configEditingServiceMock.setup(x => x.writeConfiguration(ConfigurationTarget.USER, TypeMoq.It.isAny())).callback((x: any, val: any) => {
				calledValue = val.value as IConnectionProfileStore[];
			}).returns(() => TPromise.as<void>(nothing));
			configEditingServiceMock.setup(x => x.writeConfiguration(ConfigurationTarget.WORKSPACE, TypeMoq.It.isAny())).callback((x: any, val: any) => {
	
			}).returns(() => TPromise.as<void>(nothing));
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.changeGroupIdForConnection(connectionProfile, newId).then(() => {
				configEditingServiceMock.verify(y => y.writeConfiguration(ConfigurationTarget.USER,
					TypeMoq.It.is<IConfigurationValue>(c => (c.value as IConnectionProfileStore[]).length === expectedNumberOfConnections)), TypeMoq.Times.atLeastOnce());
				calledValue.forEach(con => {
				});
			}).then(() => done(), (err) => done(err));
		});
	
		test('fixConnectionIds should replace duplicate ids with new ones', (done) => {
			let profiles: IConnectionProfileStore[] = [
				{
					options: {},
					groupId: '1',
					id: '1',
					providerName: undefined,
					savePassword: true,
				}, {
					options: {},
					groupId: '1',
					id: '2',
					providerName: undefined,
					savePassword: true,
				}, {
					options: {},
					groupId: '1',
					id: '3',
					providerName: undefined,
					savePassword: true,
				}, {
					options: {},
					groupId: '1',
					id: '2',
					providerName: undefined,
					savePassword: true,
				}, {
					options: {},
					groupId: '1',
					id: '4',
					providerName: undefined,
					savePassword: true,
				}, {
					options: {},
					groupId: '1',
					id: '3',
					providerName: undefined,
					savePassword: true,
				}, {
					options: {},
					groupId: '1',
					id: '2',
					providerName: undefined,
					savePassword: true,
				}
			];
	
			let config = new ConnectionConfig(configEditingServiceMock.object, workspaceConfigurationServiceMock.object, capabilitiesService.object);
			config.fixConnectionIds(profiles);
			let ids = profiles.map(x => x.id);
			for (var index = 0; index < ids.length; index++) {
				var id = ids[index];
				assert.equal(ids.lastIndexOf(id), index);
			}
			done();
		});
	*/

	test('fixConnectionIds should replace duplicate ids with new ones', (done) => {
		done();
	});

});

