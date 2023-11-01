/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import { fixupConnectionCredentials } from 'sql/platform/connection/common/connectionInfo';
import { IConnectionProfile, ConnectionOptionSpecialType, ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { TestCredentialsService } from 'sql/platform/credentials/test/common/testCredentialsService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { deepClone, deepFreeze } from 'vs/base/common/objects';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { AuthenticationType, mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { InMemoryStorageService } from 'vs/platform/storage/common/storage';
import { generateUuid } from 'vs/base/common/uuid';

suite('ConnectionStore', () => {
	let defaultNamedProfile: IConnectionProfile = deepFreeze({
		connectionName: 'new name',
		serverName: 'namedServer',
		databaseName: 'bcd',
		authenticationType: AuthenticationType.SqlLogin,
		userName: 'cde', // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Mock value, never actually used to connect")]
		password: generateUuid(),
		savePassword: true,
		groupId: '',
		groupFullName: '',
		serverCapabilities: undefined,
		getOptionsKey: undefined!,
		getOptionKeyIdNames: undefined!,
		matches: () => false,
		providerName: mssqlProviderName,
		options: {},
		saveProfile: true,
		id: undefined!
	});
	let capabilitiesService: TestCapabilitiesService;
	let maxRecent = 5;
	let msSQLCapabilities: ConnectionProviderProperties;
	let provider2Capabilities: ConnectionProviderProperties;
	let defaultNamedConnectionProfile: ConnectionProfile;

	setup(() => {
		// setup configuration to return maxRecent for the #MRU items

		capabilitiesService = new TestCapabilitiesService();
		let connectionProvider: azdata.ConnectionOption[] = [
			{
				name: 'connectionName',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.connectionName,
				valueType: ServiceOptionType.string
			},
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
		];
		msSQLCapabilities = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: connectionProvider
		};

		provider2Capabilities = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: connectionProvider
		};
		capabilitiesService.capabilities[mssqlProviderName] = { connection: msSQLCapabilities };
		capabilitiesService.capabilities['Provider2'] = { connection: provider2Capabilities };

		defaultNamedConnectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);
	});

	test('addActiveConnection should limit recent connection saves to the MaxRecentConnections amount', async () => {
		// Given 5 is the max # creds
		const numCreds = 6;

		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		await configurationService.updateValue('sql.maxRecentConnections', 5, ConfigurationTarget.USER);

		// When saving 4 connections
		// Expect all of them to be saved even if size is limited to 3
		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		for (let i = 0; i < numCreds; i++) {
			const cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + i });
			const connectionProfile = new ConnectionProfile(capabilitiesService, cred);
			await connectionStore.addRecentConnection(connectionProfile);
			const current = connectionStore.getRecentlyUsedConnections();
			if (i >= maxRecent) {
				assert.strictEqual(current.length, maxRecent, `expect only top ${maxRecent} creds to be saved`);
			} else {
				assert.strictEqual(current.length, i + 1, `expect all credentials to be saved ${current.length}|${i + 1} `);
			}
			assert.strictEqual(current[0].serverName, cred.serverName, 'Expect most recently saved item to be first in list');
			assert.ok(!current[0].password);
		}
		assert.strictEqual(credentialsService.credentials.size, numCreds);
	});

	test('getRecentlyUsedConnections should return connection for given provider', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();
		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const connections = connectionStore.getRecentlyUsedConnections(['Provider2']);
		assert.ok(!!connections);
		assert.ok(connections.every(c => c.providerName === 'Provider2'));
	});

	test('addActiveConnection should add same connection exactly once', async () => {

		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		// Given we save the same connection twice
		// Then expect the only 1 instance of that connection to be listed in the MRU
		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + 1 });
		const connectionProfile = new ConnectionProfile(capabilitiesService, cred);
		await connectionStore.addRecentConnection(defaultNamedConnectionProfile);
		await connectionStore.addRecentConnection(connectionProfile);
		await connectionStore.addRecentConnection(connectionProfile);
		const current = connectionStore.getRecentlyUsedConnections();
		assert.strictEqual(current.length, 2, 'expect 2 unique credentials to have been added');
		assert.strictEqual(current[0].serverName, cred.serverName, 'Expect most recently saved item to be first in list');
		assert.ok(!current[0].password);
	});

	test('addActiveConnection should save password to credential store', async () => {

		// Setup credential store to capture credentials sent to it

		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		// Given we save 1 connection with password and multiple other connections without
		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const integratedCred = Object.assign({}, defaultNamedProfile, {
			serverName: defaultNamedProfile.serverName + 'Integrated',
			authenticationType: AuthenticationType.Integrated,
			userName: '',
			password: ''
		});
		const noPwdCred = Object.assign({}, defaultNamedProfile, {
			serverName: defaultNamedProfile.serverName + 'NoPwd',
			password: ''
		});
		const connectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);

		let recentCredential: azdata.Credential;
		credentialsService.onCredential(e => recentCredential = e);

		await connectionStore.addRecentConnection(connectionProfile);

		let current = connectionStore.getRecentlyUsedConnections();
		// Then verify that since its password based we save the password
		assert.strictEqual(credentialsService.credentials.size, 1);
		assert.strictEqual(recentCredential!.password, defaultNamedProfile.password);
		assert.ok(recentCredential!.credentialId.indexOf('Profile') > -1, 'Expect credential to be marked as an Profile cred');
		assert.ok(!current[0].password);
		// When add integrated auth connection
		const integratedCredConnectionProfile = new ConnectionProfile(capabilitiesService, integratedCred);
		await connectionStore.addRecentConnection(integratedCredConnectionProfile);
		current = connectionStore.getRecentlyUsedConnections();
		// then expect not to have credential store called, but MRU count upped to 2
		assert.strictEqual(credentialsService.credentials.size, 1);
		assert.strictEqual(current.length, 2);
		// When add connection without password
		const noPwdCredConnectionProfile = new ConnectionProfile(capabilitiesService, noPwdCred);
		await connectionStore.addRecentConnection(noPwdCredConnectionProfile);
		current = connectionStore.getRecentlyUsedConnections();
		// then expect not to have credential store called, but MRU count upped to 3
		assert.strictEqual(current.length, 3);
		assert.strictEqual(credentialsService.credentials.size, 1);
	});

	test('fixupConnectionCredentials should fix blank connection profile', () => {
		let blankConnectionProfile = new ConnectionProfile(capabilitiesService, '');
		let resultProfile = fixupConnectionCredentials(blankConnectionProfile);
		assert.strictEqual(resultProfile.serverName, '');
		assert.strictEqual(resultProfile.databaseName, '');
		assert.strictEqual(resultProfile.userName, '');
		assert.strictEqual(resultProfile.password, '');
	});

	test('can clear connections list', async () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		await connectionStore.addRecentConnection(defaultNamedProfile);
		let result = connectionStore.getRecentlyUsedConnections();
		assert.strictEqual(result.length, 1);
		connectionStore.clearRecentlyUsed();
		result = connectionStore.getRecentlyUsedConnections();
		assert.strictEqual(result.length, 0);
		// Then test is complete
	});

	test('isPasswordRequired should return true for MSSQL SqlLogin', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		assert.ok(connectionStore.isPasswordRequired(defaultNamedProfile));
	});

	test('isPasswordRequired should return true for MSSQL SqlLogin for connection profile object', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const connectionProfile = new ConnectionProfile(capabilitiesService, defaultNamedProfile);

		assert.ok(connectionStore.isPasswordRequired(connectionProfile));
	});

	test('isPasswordRequired should return false if the password is not required in capabilities', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const providerName: string = 'providername';
		const connectionProvider = msSQLCapabilities.connectionOptions.map(o => {
			if (o.name === 'password') {
				o.isRequired = false;
			}
			return o;
		});
		const providerCapabilities = {
			providerId: providerName,
			displayName: providerName,
			connectionOptions: connectionProvider
		};

		capabilitiesService.capabilities[providerName] = { connection: providerCapabilities };

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile, { providerName: providerName });

		assert.ok(!connectionStore.isPasswordRequired(connectionProfile));
	});

	test('saveProfile should save the password after the profile is saved', async () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const password: string = 'asdf!@#$';
		const connectionProfile: IConnectionProfile = Object.assign({}, defaultNamedProfile, { password });

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		const profile = await connectionStore.saveProfile(connectionProfile);
		// add connection should be called with a profile without password
		assert.strictEqual(profile.password, password, 'The returned profile should still keep the password');
		assert.ok(!!profile.groupId, 'Group id should be set in the profile');
	});

	test('getGroupFromId returns undefined when there is no group with the given ID', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const group = connectionStore.getGroupFromId('invalidId');
		assert.strictEqual(group, undefined, 'Returned group was not undefined when there was no group with the given ID');
	});

	test('getGroupFromId returns the group that has the given ID', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const parentGroupId = 'parentGroup';
		const childGroupId = 'childGroup';

		const groups: IConnectionProfileGroup[] = [
			{
				id: parentGroupId,
				name: parentGroupId,
				color: undefined,
				description: '',
				parentId: ''
			},
			{
				id: childGroupId,
				name: childGroupId,
				color: undefined,
				description: '',
				parentId: parentGroupId
			}
		];

		configurationService.updateValue('datasource.connectionGroups', groups, ConfigurationTarget.USER);
		let connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		// If I look up the parent group using its ID, then I get back the correct group
		let actualGroup = connectionStore.getGroupFromId(parentGroupId)!;
		assert.strictEqual(actualGroup.id, parentGroupId, 'Did not get the parent group when looking it up with its ID');

		// If I look up the child group using its ID, then I get back the correct group
		actualGroup = connectionStore.getGroupFromId(childGroupId)!;
		assert.strictEqual(actualGroup.id, childGroupId, 'Did not get the child group when looking it up with its ID');
	});

	test('getProfileWithoutPassword can return the profile without credentials in the password property or options dictionary', () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);
		const profile = deepClone(defaultNamedProfile);
		profile.options['password'] = profile.password;
		profile.id = 'testId';
		let expectedProfile = Object.assign({}, profile);
		expectedProfile.password = '';
		expectedProfile.options['password'] = '';
		expectedProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, expectedProfile).toIConnectionProfile();
		let profileWithoutCredentials = connectionStore.getProfileWithoutPassword(profile);
		assert.deepStrictEqual(profileWithoutCredentials.toIConnectionProfile(), expectedProfile);
	});

	test('addPassword gets the password from the credentials service', async () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const profile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, Object.assign({}, defaultNamedProfile, { password: undefined }));

		const credId = `Microsoft.SqlTools|itemtype:Profile|id:${profile.getConnectionInfoId()}`;
		const password: string = 'asdf!@#$';

		await credentialsService.saveCredential(credId, password);

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		const passwordProfile = (await connectionStore.addSavedPassword(profile)).profile;

		assert.strictEqual(passwordProfile.password, password);
	});

	test('getConnectionProfileGroups', async () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const parentGroupId = 'parentGroup';
		const childGroupId = 'childGroup';
		const groups: IConnectionProfileGroup[] = [
			{
				id: parentGroupId,
				name: parentGroupId,
				color: undefined,
				description: '',
				parentId: ''
			},
			{
				id: childGroupId,
				name: childGroupId,
				color: undefined,
				description: '',
				parentId: parentGroupId
			}
		];

		configurationService.updateValue('datasource.connectionGroups', groups, ConfigurationTarget.USER);

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		const connectionGroups = connectionStore.getConnectionProfileGroups();

		for (const group of connectionGroups) {
			const foundGroup = groups.find(g => g.id === group.id);
			assert.ok(foundGroup);
		}
	});

	test('removing connection correctly removes', async () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		for (let i = 0; i < 5; i++) {
			const cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + i });
			const connectionProfile = new ConnectionProfile(capabilitiesService, cred);
			await connectionStore.addRecentConnection(connectionProfile);
			const current = connectionStore.getRecentlyUsedConnections();
			assert.strictEqual(current.length, i + 1);
		}

		for (let i = 0; i < 5; i++) {
			const cred = Object.assign({}, defaultNamedProfile, { serverName: defaultNamedProfile.serverName + i });
			const connectionProfile = new ConnectionProfile(capabilitiesService, cred);
			connectionStore.removeRecentConnection(connectionProfile);
			const current = connectionStore.getRecentlyUsedConnections();
			assert.strictEqual(current.length, 4 - i);
		}
	});

	test('getRecentlyUsedConnections correctly fills in group names', async () => {
		const storageService = new InMemoryStorageService();
		const configurationService = new TestConfigurationService();
		const credentialsService = new TestCredentialsService();

		const connectionStore = new ConnectionStore(storageService, configurationService,
			credentialsService, capabilitiesService);

		const parentGroupId = 'parentGroup';
		const parentGroupName = 'parentGroupName';
		const group: IConnectionProfileGroup = {
			id: parentGroupId,
			name: parentGroupName,
			color: undefined,
			description: '',
			parentId: ''
		};
		const connection: azdata.IConnectionProfile = {
			options: [],
			connectionName: '',
			serverName: 'server1',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			providerName: mssqlProviderName,
			groupId: parentGroupId,
			groupFullName: '',
			savePassword: true,
			saveProfile: true,
			id: 'server1'
		};

		configurationService.updateValue('datasource.connectionGroups', [group], ConfigurationTarget.USER);
		configurationService.updateValue('datasource.connections', [connection], ConfigurationTarget.USER);

		connectionStore.addRecentConnection(ConnectionProfile.fromIConnectionProfile(capabilitiesService, connection));

		const connections = connectionStore.getRecentlyUsedConnections();

		assert.strictEqual(connections[0].groupFullName, parentGroupName);
	});
});
