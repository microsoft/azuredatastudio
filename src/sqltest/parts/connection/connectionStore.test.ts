/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as TypeMoq from 'typemoq';
import { ConnectionConfig } from 'sql/platform/connection/common/connectionConfig';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { WorkspaceConfigurationTestService } from 'sqltest/stubs/workspaceConfigurationTestService';
import * as Constants from 'sql/platform/connection/common/constants';
import { StorageTestService } from 'sqltest/stubs/storageTestService';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import { CredentialsService } from 'sql/platform/credentials/common/credentialsService';
import * as assert from 'assert';
import { Memento } from 'vs/workbench/common/memento';
import { CapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import * as sqlops from 'sqlops';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { Emitter } from 'vs/base/common/event';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { CapabilitiesTestService } from '../../stubs/capabilitiesTestService';
import { ConnectionProviderProperties } from 'sql/workbench/parts/connection/common/connectionProviderExtension';

suite('SQL ConnectionStore tests', () => {
	let defaultNamedProfile: IConnectionProfile;
	let defaultUnnamedProfile: IConnectionProfile;
	let profileForProvider2: IConnectionProfile;
	let context: TypeMoq.Mock<Memento>;
	let credentialStore: TypeMoq.Mock<CredentialsService>;
	let connectionConfig: TypeMoq.Mock<ConnectionConfig>;
	let workspaceConfigurationServiceMock: TypeMoq.Mock<WorkspaceConfigurationTestService>;
	let storageServiceMock: TypeMoq.Mock<StorageTestService>;
	let capabilitiesService: CapabilitiesTestService;
	let mementoArray: any = [];
	let maxRecent = 5;
	let msSQLCapabilities: ConnectionProviderProperties;
	let provider2Capabilities: ConnectionProviderProperties;
	let defaultNamedConnectionProfile: ConnectionProfile;

	setup(() => {
		defaultNamedProfile = Object.assign({}, {
			connectionName: 'new name',
			serverName: 'namedServer',
			databaseName: 'bcd',
			authenticationType: 'SqlLogin',
			userName: 'cde',
			password: 'asdf!@#$',
			savePassword: true,
			groupId: '',
			groupFullName: '',
			getOptionsKey: undefined,
			matches: undefined,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined
		});

		defaultUnnamedProfile = Object.assign({}, {
			connectionName: 'new name',
			serverName: 'unnamedServer',
			databaseName: undefined,
			authenticationType: 'SqlLogin',
			userName: 'aUser',
			password: 'asdf!@#$',
			savePassword: true,
			groupId: '',
			groupFullName: '',
			getOptionsKey: undefined,
			matches: undefined,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined
		});

		profileForProvider2 = Object.assign({}, {
			connectionName: 'new name',
			serverName: 'unnamedServer',
			databaseName: undefined,
			authenticationType: 'SqlLogin',
			userName: 'aUser',
			password: 'asdf!@#$',
			savePassword: true,
			groupId: '',
			groupFullName: '',
			getOptionsKey: undefined,
			matches: undefined,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined
		});

		storageServiceMock = TypeMoq.Mock.ofType(StorageTestService);

		let momento = new Memento('ConnectionManagement', storageServiceMock.object);
		context = TypeMoq.Mock.ofInstance(momento);
		context.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => mementoArray);

		credentialStore = TypeMoq.Mock.ofType(CredentialsService);
		connectionConfig = TypeMoq.Mock.ofType(ConnectionConfig);

		// setup configuration to return maxRecent for the #MRU items

		let configResult: { [key: string]: any } = {};
		configResult[Constants.configMaxRecentConnections] = maxRecent;

		workspaceConfigurationServiceMock = TypeMoq.Mock.ofType(WorkspaceConfigurationTestService);
		workspaceConfigurationServiceMock.setup(x => x.getValue(Constants.sqlConfigSectionName))
			.returns(() => configResult);

		let extensionManagementServiceMock = {
			getInstalled: () => {
				return Promise.resolve([]);
			}
		};

		capabilitiesService = new CapabilitiesTestService();
		let connectionProvider: sqlops.ConnectionOption[] = [
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
			}
		];
		msSQLCapabilities = {
			providerId: 'MSSQL',
			displayName: 'MSSQL',
			connectionOptions: connectionProvider
		};

		provider2Capabilities = {
			providerId: 'MSSQL',
			displayName: 'MSSQL',
			connectionOptions: connectionProvider
		};
		capabilitiesService.capabilities['MSSQL'] = { connection: msSQLCapabilities };
		capabilitiesService.capabilities['Provider2'] = { connection: provider2Capabilities };
		let groups: IConnectionProfileGroup[] = [
			{
				id: 'root',
				name: 'root',
				parentId: '',
				color: '',
				description: ''
			},
			{
				id: 'g1',
				name: 'g1',
				parentId: 'root',
				color: 'blue',
				description: 'g1'
			}
		];
		connectionConfig.setup(x => x.getAllGroups()).returns(() => groups);

		defaultNamedConnectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);
	});

	test('addActiveConnection should limit recent connection saves to the MaxRecentConnections amount', (done) => {
		// Given 5 is the max # creds
		let numCreds = 6;

		// setup memento for MRU to return a list we have access to
		credentialStore.setup(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(true));

		// When saving 4 connections
		// Expect all of them to be saved even if size is limited to 3
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let promise = Promise.resolve<void>();
		for (let i = 0; i < numCreds; i++) {
			let cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + i });
			let connectionProfile = new ConnectionProfile(capabilitiesService, cred);
			promise = promise.then(() => {
				return connectionStore.addActiveConnection(connectionProfile);
			}).then(() => {
				let current = connectionStore.getRecentlyUsedConnections();
				if (i >= maxRecent) {
					assert.equal(current.length, maxRecent, `expect only top ${maxRecent} creds to be saved`);
				} else {
					assert.equal(current.length, i + 1, `expect all credentials to be saved ${current.length}|${i + 1} `);
				}
				assert.equal(current[0].serverName, cred.serverName, 'Expect most recently saved item to be first in list');
				assert.ok(!current[0].password);
			});
		}
		promise.then(() => {
			credentialStore.verify(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(numCreds));
			let recentConnections = connectionStore.getActiveConnections();
			assert.equal(numCreds, recentConnections.length, `expect number of active connection ${numCreds}|${recentConnections.length} `);
			done();
		}, err => {
			// Must call done here so test indicates it's finished if errors occur
			done(err);
		});
	});

	test('getRecentlyUsedConnections should return connection for given provider', () => {
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let connections = connectionStore.getRecentlyUsedConnections(['Provider2']);
		assert.notEqual(connections, undefined);
		assert.equal(connections.every(c => c.providerName === 'Provider2'), true);
	});

	test('addActiveConnection should add same connection exactly once', (done) => {
		// setup memento for MRU to return a list we have access to
		credentialStore.setup(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(true));

		// Given we save the same connection twice
		// Then expect the only 1 instance of that connection to be listed in the MRU
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		connectionStore.clearActiveConnections();
		connectionStore.clearRecentlyUsed();
		let promise = Promise.resolve();
		let cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + 1 });
		let connectionProfile = new ConnectionProfile(capabilitiesService, cred);
		promise = promise.then(() => {
			return connectionStore.addActiveConnection(defaultNamedConnectionProfile);
		}).then(() => {
			return connectionStore.addActiveConnection(connectionProfile);
		}).then(() => {
			return connectionStore.addActiveConnection(connectionProfile);
		}).then(() => {
			let current = connectionStore.getRecentlyUsedConnections();
			assert.equal(current.length, 2, 'expect 2 unique credentials to have been added');
			assert.equal(current[0].serverName, cred.serverName, 'Expect most recently saved item to be first in list');
			assert.ok(!current[0].password);
		}).then(() => done(), err => done(err));
	});

	test('addActiveConnection should save password to credential store', (done) => {

		// Setup credential store to capture credentials sent to it
		let capturedCreds: any;
		credentialStore.setup(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.callback((cred: string, pass: any) => {
				capturedCreds = {
					'credentialId': cred,
					'password': pass
				};
			})
			.returns(() => Promise.resolve(true));

		// Given we save 1 connection with password and multiple other connections without
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		connectionStore.clearActiveConnections();
		connectionStore.clearRecentlyUsed();
		let integratedCred = Object.assign({}, defaultNamedProfile, {
			serverName: defaultNamedProfile.serverName + 'Integrated',
			authenticationType: 'Integrated',
			userName: '',
			password: ''
		});
		let noPwdCred = Object.assign({}, defaultNamedProfile, {
			serverName: defaultNamedProfile.serverName + 'NoPwd',
			password: ''
		});
		let connectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);

		let expectedCredCount = 0;
		let promise = Promise.resolve();
		promise = promise.then(() => {
			expectedCredCount++;
			return connectionStore.addActiveConnection(connectionProfile);
		}).then(() => {
			let current = connectionStore.getRecentlyUsedConnections();
			// Then verify that since its password based we save the password
			credentialStore.verify(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.strictEqual(capturedCreds.password, defaultNamedProfile.password);
			let credId: string = capturedCreds.credentialId;
			assert.ok(credId.includes(ConnectionStore.CRED_PROFILE_USER), 'Expect credential to be marked as an Profile cred');
			assert.ok(!current[0].password);
		}).then(() => {
			// When add integrated auth connection
			expectedCredCount++;
			let integratedCredConnectionProfile = new ConnectionProfile(capabilitiesService, integratedCred);
			return connectionStore.addActiveConnection(integratedCredConnectionProfile);
		}).then(() => {
			let current = connectionStore.getRecentlyUsedConnections();
			// then expect no to have credential store called, but MRU count upped to 2
			credentialStore.verify(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.equal(current.length, expectedCredCount, `expect ${expectedCredCount} unique credentials to have been added`);
		}).then(() => {
			// When add connection without password
			expectedCredCount++;
			let noPwdCredConnectionProfile = new ConnectionProfile(capabilitiesService, noPwdCred);
			return connectionStore.addActiveConnection(noPwdCredConnectionProfile);
		}).then(() => {
			let current = connectionStore.getRecentlyUsedConnections();
			// then expect no to have credential store called, but MRU count upped to 3
			credentialStore.verify(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.equal(current.length, expectedCredCount, `expect ${expectedCredCount} unique credentials to have been added`);
		}).then(() => done(), err => done(err));
	});

	test('can clear connections list', (done) => {
		connectionConfig.setup(x => x.getConnections(TypeMoq.It.isAny())).returns(() => []);

		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);

		// When we clear the connections list and get the list of available connection items
		connectionStore.clearActiveConnections();
		connectionStore.clearRecentlyUsed();
		// Expect no connection items
		let result = connectionStore.getActiveConnections();
		let expectedCount = 0; // 1 for create connection profile
		assert.equal(result.length, expectedCount);
		result = connectionStore.getRecentlyUsedConnections();
		assert.equal(result.length, expectedCount);
		// Then test is complete
		done();
	});

	test('isPasswordRequired should return true for MSSQL SqlLogin', () => {

		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);

		let expected: boolean = true;
		let actual = connectionStore.isPasswordRequired(defaultNamedProfile);

		assert.equal(expected, actual);
	});

	test('isPasswordRequired should return true for MSSQL SqlLogin for connection profile object', () => {
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let connectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);
		let expected: boolean = true;
		let actual = connectionStore.isPasswordRequired(connectionProfile);

		assert.equal(expected, actual);
	});

	test('isPasswordRequired should return false if the password is not required in capabilities', () => {
		let providerName: string = 'providername';
		let connectionProvider = msSQLCapabilities.connectionOptions.map(o => {
			if (o.name === 'password') {
				o.isRequired = false;
			}
			return o;
		});
		let providerCapabilities = {
			providerId: providerName,
			displayName: providerName,
			connectionOptions: connectionProvider
		};

		capabilitiesService.capabilities[providerName] = { connection: providerCapabilities };

		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile, { providerName: providerName });
		let expected: boolean = false;
		let actual = connectionStore.isPasswordRequired(connectionProfile);

		assert.equal(expected, actual);
	});

	test('saveProfile should save the password after the profile is saved', done => {
		let password: string = 'asdf!@#$';
		let groupId: string = 'group id';
		let connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile, { password: password });
		let savedConnection: IConnectionProfile = Object.assign({}, connectionProfile, { groupId: groupId, password: '' });
		connectionConfig.setup(x => x.addConnection(TypeMoq.It.isAny())).returns(() => Promise.resolve(savedConnection));
		credentialStore.setup(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(true));

		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);

		connectionStore.saveProfile(connectionProfile).then(profile => {
			// add connection should be called with a profile without password
			connectionConfig.verify(x => x.addConnection(TypeMoq.It.is<IConnectionProfile>(c => c.password === '')), TypeMoq.Times.once());
			credentialStore.verify(x => x.saveCredential(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.equal(profile.password, password, 'The returned profile should still keep the password');
			assert.equal(profile.groupId, groupId, 'Group id should be set in the profile');
			done();
		}).catch(err => {
			assert.fail(err);
			done(err);
		});
	});

	test('addConnectionToMemento should not add duplicate items', () => {
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let mementoKey = 'RECENT_CONNECTIONS2';
		connectionStore.clearFromMemento(mementoKey);
		let connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile);
		connectionStore.addConnectionToMemento(connectionProfile, mementoKey);

		connectionProfile = Object.assign({}, defaultNamedProfile, { authenticationType: 'Integrated', userName: '' });
		connectionStore.addConnectionToMemento(connectionProfile, mementoKey);

		let currentList = connectionStore.getConnectionsFromMemento(mementoKey);
		assert.equal(currentList.length, 2, 'Adding same connection with different auth');

		connectionProfile = Object.assign({}, defaultNamedProfile, { groupFullName: 'new group' });
		connectionStore.addConnectionToMemento(connectionProfile, mementoKey);

		currentList = connectionStore.getConnectionsFromMemento(mementoKey);
		assert.equal(currentList.length, 3, 'Adding same connection with different group name');

		connectionProfile = Object.assign({}, defaultNamedProfile,
			{ groupFullName: defaultNamedProfile.groupFullName.toUpperCase() });
		connectionStore.addConnectionToMemento(connectionProfile, mementoKey);

		currentList = connectionStore.getConnectionsFromMemento(mementoKey);
		assert.equal(currentList.length, 3, 'Adding same connection with same group name but uppercase');

		connectionProfile = Object.assign({}, defaultNamedProfile,
			{ groupFullName: '' });
		connectionStore.addConnectionToMemento(connectionProfile, mementoKey);

		currentList = connectionStore.getConnectionsFromMemento(mementoKey);
		assert.equal(currentList.length, 3, 'Adding same connection with group empty string');

		connectionProfile = Object.assign({}, defaultNamedProfile,
			{ groupFullName: '/' });
		connectionStore.addConnectionToMemento(connectionProfile, mementoKey);

		currentList = connectionStore.getConnectionsFromMemento(mementoKey);
		assert.equal(currentList.length, 3, 'Adding same connection with group /');
	});

	test('getGroupFromId returns undefined when there is no group with the given ID', () => {
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let group = connectionStore.getGroupFromId('invalidId');
		assert.equal(group, undefined, 'Returned group was not undefined when there was no group with the given ID');
	});

	test('getGroupFromId returns the group that has the given ID', () => {
		// Set up the server groups with an additional group that contains a child group
		let groups: IConnectionProfileGroup[] = connectionConfig.object.getAllGroups();
		let parentGroupId = 'parentGroup';
		let childGroupId = 'childGroup';
		let parentGroup = new ConnectionProfileGroup(parentGroupId, undefined, parentGroupId, '', '');
		let childGroup = new ConnectionProfileGroup(childGroupId, parentGroup, childGroupId, '', '');
		groups.push(parentGroup, childGroup);
		let newConnectionConfig = TypeMoq.Mock.ofType(ConnectionConfig);
		newConnectionConfig.setup(x => x.getAllGroups()).returns(() => groups);
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, newConnectionConfig.object);

		// If I look up the parent group using its ID, then I get back the correct group
		let actualGroup = connectionStore.getGroupFromId(parentGroupId);
		assert.equal(actualGroup.id, parentGroupId, 'Did not get the parent group when looking it up with its ID');

		// If I look up the child group using its ID, then I get back the correct group
		actualGroup = connectionStore.getGroupFromId(childGroupId);
		assert.equal(actualGroup.id, childGroupId, 'Did not get the child group when looking it up with its ID');
	});

	test('getProfileWithoutPassword can return the profile without credentials in the password property or options dictionary', () => {
		let connectionStore = new ConnectionStore(storageServiceMock.object, context.object, undefined, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, connectionConfig.object);
		let profile = Object.assign({}, defaultNamedProfile);
		profile.options['password'] = profile.password;
		profile.id = 'testId';
		let expectedProfile = Object.assign({}, profile);
		expectedProfile.password = '';
		expectedProfile.options['password'] = '';
		expectedProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, expectedProfile).toIConnectionProfile();
		let profileWithoutCredentials = connectionStore.getProfileWithoutPassword(profile);
		assert.deepEqual(profileWithoutCredentials.toIConnectionProfile(), expectedProfile);
	});
});