/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { TestStateService } from 'sql/platform/connection/test/common/testStateService';
import { TestCredentialsService } from 'sql/platform/credentials/test/common/testCredentialsService';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProviderProperties } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { deepFreeze } from 'vs/base/common/objects';
import { IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { connectionGroupsArrayName } from 'sql/platform/connection/common/constants';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';

suite('ConnectionStore', () => {
	let defaultNamedProfile: IConnectionProfile = deepFreeze({
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
	let capabilitiesService: CapabilitiesTestService;
	let maxRecent = 5;
	let msSQLCapabilities: ConnectionProviderProperties;
	let provider2Capabilities: ConnectionProviderProperties;
	let defaultNamedConnectionProfile: ConnectionProfile;

	setup(() => {
		// setup configuration to return maxRecent for the #MRU items

		capabilitiesService = new CapabilitiesTestService();
		let connectionProvider: azdata.ConnectionOption[] = [
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

		defaultNamedConnectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);
	});

	test('addActiveConnection should limit recent connection saves to the MaxRecentConnections amount', async () => {
		// Given 5 is the max # creds
		let numCreds = 6;

		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		await configurationService.updateValue('sql.maxRecentConnections', 5, ConfigurationTarget.USER);

		// When saving 4 connections
		// Expect all of them to be saved even if size is limited to 3
		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
		for (let i = 0; i < numCreds; i++) {
			let cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + i });
			let connectionProfile = new ConnectionProfile(capabilitiesService, cred);
			await connectionStore.addActiveConnection(connectionProfile);
			let current = connectionStore.getRecentlyUsedConnections();
			if (i >= maxRecent) {
				assert.equal(current.length, maxRecent, `expect only top ${maxRecent} creds to be saved`);
			} else {
				assert.equal(current.length, i + 1, `expect all credentials to be saved ${current.length}|${i + 1} `);
			}
			assert.equal(current[0].serverName, cred.serverName, 'Expect most recently saved item to be first in list');
			assert.ok(!current[0].password);
		}
		assert.equal(credentialsService.credentials.size, numCreds);
		let recentConnections = connectionStore.getActiveConnections();
		assert.equal(recentConnections.length, numCreds , `expect number of active connection ${numCreds}|${recentConnections.length} `);
	});

	test('getRecentlyUsedConnections should return connection for given provider', () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();
		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
		let connections = connectionStore.getRecentlyUsedConnections(['Provider2']);
		assert.ok(!!connections);
		assert.ok(connections.every(c => c.providerName === 'Provider2'));
	});

	test('addActiveConnection should add same connection exactly once', async () => {

		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		// Given we save the same connection twice
		// Then expect the only 1 instance of that connection to be listed in the MRU
		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
		let cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + 1 });
		let connectionProfile = new ConnectionProfile(capabilitiesService, cred);
		await connectionStore.addActiveConnection(defaultNamedConnectionProfile);
		await connectionStore.addActiveConnection(connectionProfile);
		await connectionStore.addActiveConnection(connectionProfile);
		let current = connectionStore.getRecentlyUsedConnections();
		assert.equal(current.length, 2, 'expect 2 unique credentials to have been added');
		assert.equal(current[0].serverName, cred.serverName, 'Expect most recently saved item to be first in list');
		assert.ok(!current[0].password);
	});

	test('addActiveConnection should save password to credential store', async () => {

		// Setup credential store to capture credentials sent to it

		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		// Given we save 1 connection with password and multiple other connections without
		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
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

		let recentCredential: azdata.Credential;
		credentialsService.onCredential(e => recentCredential = e);

		await connectionStore.addActiveConnection(connectionProfile);

		let current = connectionStore.getRecentlyUsedConnections();
		// Then verify that since its password based we save the password
		assert.equal(credentialsService.credentials.size, 1);
		assert.strictEqual(recentCredential.password, defaultNamedProfile.password);
		assert.ok(recentCredential.credentialId.includes(ConnectionStore.CRED_PROFILE_USER), 'Expect credential to be marked as an Profile cred');
		assert.ok(!current[0].password);
		// When add integrated auth connection
		let integratedCredConnectionProfile = new ConnectionProfile(capabilitiesService, integratedCred);
		await connectionStore.addActiveConnection(integratedCredConnectionProfile);
		current = connectionStore.getRecentlyUsedConnections();
		// then expect not to have credential store called, but MRU count upped to 2
		assert.equal(credentialsService.credentials.size, 1);
		assert.equal(current.length, 2);
		// When add connection without password
		let noPwdCredConnectionProfile = new ConnectionProfile(capabilitiesService, noPwdCred);
		await connectionStore.addActiveConnection(noPwdCredConnectionProfile);
		current = connectionStore.getRecentlyUsedConnections();
		// then expect not to have credential store called, but MRU count upped to 3
		assert.equal(current.length, 3);
		assert.equal(credentialsService.credentials.size, 1);
	});

	test('can clear connections list', async () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);

		await connectionStore.addActiveConnection(defaultNamedProfile);
		let result = connectionStore.getRecentlyUsedConnections();
		assert.equal(result.length, 1);
		result = connectionStore.getActiveConnections();
		assert.equal(result.length, 1);
		connectionStore.clearRecentlyUsed();
		result = connectionStore.getRecentlyUsedConnections();
		assert.equal(result.length, 0);
		// Then test is complete
	});

	test('isPasswordRequired should return true for MSSQL SqlLogin', () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);

		assert.ok(connectionStore.isPasswordRequired(defaultNamedProfile));
	});

	test('isPasswordRequired should return true for MSSQL SqlLogin for connection profile object', () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
		let connectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);

		assert.ok(connectionStore.isPasswordRequired(connectionProfile));
	});

	test('isPasswordRequired should return false if the password is not required in capabilities', () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

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

		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
		let connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile, { providerName: providerName });

		assert.ok(!connectionStore.isPasswordRequired(connectionProfile));
	});

	test('saveProfile should save the password after the profile is saved', async () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		let password: string = 'asdf!@#$';
		let connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile, { password });

		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);

		let profile = await connectionStore.saveProfile(connectionProfile);
		// add connection should be called with a profile without password
		assert.equal(profile.password, password, 'The returned profile should still keep the password');
		assert.ok(!!profile.groupId, 'Group id should be set in the profile');
	});

	test('addConnectionToMemento should not add duplicate items', () => {
		let stateService = new TestStateService();
		let configurationService = new TestConfigurationService();
		let credentialsService = new TestCredentialsService();

		let connectionStore = new ConnectionStore(stateService, configurationService,
			credentialsService, capabilitiesService);
		let mementoKey = 'RECENT_CONNECTIONS2';
		let connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile);
		connectionStore.addConnectionToState(connectionProfile, mementoKey);

		connectionProfile = Object.assign({}, defaultNamedProfile, { authenticationType: 'Integrated', userName: '' });
		connectionStore.addConnectionToState(connectionProfile, mementoKey);

		let currentList = connectionStore.getConnectionsFromState(mementoKey);
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

	/*
	test('getGroupFromId returns undefined when there is no group with the given ID', () => {
		let connectionStore = new ConnectionStore(context.object, workspaceConfigurationServiceMock.object,
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
		let connectionStore = new ConnectionStore(context.object, workspaceConfigurationServiceMock.object,
			credentialStore.object, capabilitiesService, newConnectionConfig.object);

		// If I look up the parent group using its ID, then I get back the correct group
		let actualGroup = connectionStore.getGroupFromId(parentGroupId);
		assert.equal(actualGroup.id, parentGroupId, 'Did not get the parent group when looking it up with its ID');

		// If I look up the child group using its ID, then I get back the correct group
		actualGroup = connectionStore.getGroupFromId(childGroupId);
		assert.equal(actualGroup.id, childGroupId, 'Did not get the child group when looking it up with its ID');
	});

	test('getProfileWithoutPassword can return the profile without credentials in the password property or options dictionary', () => {
		let connectionStore = new ConnectionStore(context.object, workspaceConfigurationServiceMock.object,
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
	*/
});
