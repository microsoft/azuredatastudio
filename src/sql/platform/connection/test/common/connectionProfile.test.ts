/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile, IConnectionProfileStore, ServiceOptionType, ConnectionOptionSpecialType } from 'sql/platform/connection/common/interfaces';
import * as azdata from 'azdata';
import * as assert from 'assert';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';

suite('SQL ConnectionProfileInfo tests', () => {
	let msSQLCapabilities: ConnectionProviderProperties;
	let capabilitiesService: TestCapabilitiesService;

	let iConnectionProfile: IConnectionProfile = {
		connectionName: 'new name',
		serverName: 'new server',
		databaseName: 'database',
		userName: 'user',
		password: 'password',
		authenticationType: '',
		savePassword: true,
		groupFullName: 'g2/g2-2',
		groupId: 'group id',
		serverCapabilities: undefined,
		getOptionsKey: undefined!,
		getOptionKeyIdNames: undefined!,
		matches: undefined!,
		providerName: mssqlProviderName,
		options: {},
		saveProfile: true,
		id: undefined!
	};

	let connectionProfile: azdata.connection.ConnectionProfile = {
		connectionName: 'new name',
		serverName: 'new server',
		databaseName: 'database',
		userName: 'user',
		password: 'password',
		authenticationType: '',
		savePassword: true,
		groupFullName: 'g2/g2-2',
		groupId: 'group id',
		providerId: mssqlProviderName,
		options: {
			'encrypt': true,
			'trustServerCertificate': true
		},
		saveProfile: true,
		connectionId: 'my id'
	};

	let storedProfile: IConnectionProfileStore = {
		groupId: 'groupId',
		id: 'id',
		options: {
			connectionName: 'new name',
			serverName: 'new server',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: ''
		},
		providerName: mssqlProviderName,
		savePassword: true
	};

	setup(() => {
		let connectionProvider: azdata.ConnectionOption[] = [
			{
				name: 'connectionName',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				objectType: undefined,
				isArray: false,
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
				objectType: undefined,
				isArray: false,
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
				objectType: undefined,
				isArray: false,
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
				objectType: undefined,
				isArray: false,
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
				objectType: undefined,
				isArray: false,
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
				objectType: undefined,
				isArray: false,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.password,
				valueType: ServiceOptionType.string
			},
			{
				name: 'encrypt',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: "true",
				objectType: undefined,
				isArray: false,
				isIdentity: false,
				showOnConnectionDialog: true,
				isRequired: false,
				specialValueType: undefined,
				valueType: ServiceOptionType.boolean
			},
			{
				name: 'trustServerCertificate',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: "false",
				objectType: undefined,
				isArray: false,
				isIdentity: false,
				showOnConnectionDialog: true,
				isRequired: false,
				specialValueType: undefined,
				valueType: ServiceOptionType.boolean
			},
		];
		msSQLCapabilities = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: connectionProvider,
			useFullOptions: true
		};
		capabilitiesService = new TestCapabilitiesService();
		capabilitiesService.capabilities[mssqlProviderName] = { connection: msSQLCapabilities };
	});

	test('set properties should set the values correctly', () => {
		let conn = new ConnectionProfile(capabilitiesService, undefined!);
		assert.strictEqual(conn.serverName, undefined);
		conn.connectionName = iConnectionProfile.connectionName!;
		conn.serverName = iConnectionProfile.serverName;
		conn.databaseName = iConnectionProfile.databaseName!;
		conn.authenticationType = iConnectionProfile.authenticationType;
		conn.password = iConnectionProfile.password;
		conn.userName = iConnectionProfile.userName;
		conn.groupId = iConnectionProfile.groupId;
		conn.groupFullName = iConnectionProfile.groupFullName;
		conn.savePassword = iConnectionProfile.savePassword;
		assert.strictEqual(conn.connectionName, iConnectionProfile.connectionName);
		assert.strictEqual(conn.serverName, iConnectionProfile.serverName);
		assert.strictEqual(conn.databaseName, iConnectionProfile.databaseName);
		assert.strictEqual(conn.authenticationType, iConnectionProfile.authenticationType);
		assert.strictEqual(conn.password, iConnectionProfile.password);
		assert.strictEqual(conn.userName, iConnectionProfile.userName);
		assert.strictEqual(conn.groupId, iConnectionProfile.groupId);
		assert.strictEqual(conn.groupFullName, iConnectionProfile.groupFullName);
		assert.strictEqual(conn.savePassword, iConnectionProfile.savePassword);
	});

	test('constructor should initialize the options given a valid IConnectionProfile model', () => {
		let conn = new ConnectionProfile(capabilitiesService, iConnectionProfile);

		assert.strictEqual(conn.connectionName, iConnectionProfile.connectionName);
		assert.strictEqual(conn.serverName, iConnectionProfile.serverName);
		assert.strictEqual(conn.databaseName, iConnectionProfile.databaseName);
		assert.strictEqual(conn.authenticationType, iConnectionProfile.authenticationType);
		assert.strictEqual(conn.password, iConnectionProfile.password);
		assert.strictEqual(conn.userName, iConnectionProfile.userName);
		assert.strictEqual(conn.groupId, iConnectionProfile.groupId);
		assert.strictEqual(conn.groupFullName, iConnectionProfile.groupFullName);
		assert.strictEqual(conn.savePassword, iConnectionProfile.savePassword);
		assert.strictEqual(conn.providerName, iConnectionProfile.providerName);
	});

	test('constructor should initialize the options given a valid azdata.connection.ConnectionProfile model', () => {
		let conn = new ConnectionProfile(capabilitiesService, connectionProfile);

		assert.strictEqual(conn.connectionName, connectionProfile.connectionName);
		assert.strictEqual(conn.serverName, connectionProfile.serverName);
		assert.strictEqual(conn.databaseName, connectionProfile.databaseName);
		assert.strictEqual(conn.authenticationType, connectionProfile.authenticationType);
		assert.strictEqual(conn.password, connectionProfile.password);
		assert.strictEqual(conn.userName, connectionProfile.userName);
		assert.strictEqual(conn.groupId, connectionProfile.groupId);
		assert.strictEqual(conn.groupFullName, connectionProfile.groupFullName);
		assert.strictEqual(conn.savePassword, connectionProfile.savePassword);
		assert.strictEqual(conn.providerName, connectionProfile.providerId);
		assert.strictEqual(conn.options['encrypt'], connectionProfile.options['encrypt']);
		assert.strictEqual(conn.options['trustServerCertificate'], connectionProfile.options['trustServerCertificate']);
	});

	test('getOptionsKey should create a valid unique id', () => {
		let conn = new ConnectionProfile(capabilitiesService, iConnectionProfile);
		let expectedId = 'providerName:MSSQL|authenticationType:|connectionName:new name|databaseName:database|serverName:new server|userName:user|databaseDisplayName:database|groupId:group id';
		let id = conn.getOptionsKey();
		assert.strictEqual(id, expectedId);
	});

	test('createFromStoredProfile should create connection profile from stored profile', () => {
		let savedProfile = storedProfile;
		let connectionProfile = ConnectionProfile.createFromStoredProfile(savedProfile, capabilitiesService);
		assert.strictEqual(savedProfile.groupId, connectionProfile.groupId);
		assert.deepStrictEqual(savedProfile.providerName, connectionProfile.providerName);
		assert.deepStrictEqual(savedProfile.savePassword, connectionProfile.savePassword);
		assert.deepStrictEqual(savedProfile.id, connectionProfile.id);
	});

	test('createFromStoredProfile should set the id to new guid if not set in stored profile', () => {
		let savedProfile: IConnectionProfileStore = Object.assign({}, storedProfile, { id: undefined });
		let connectionProfile = ConnectionProfile.createFromStoredProfile(savedProfile, capabilitiesService);
		assert.strictEqual(savedProfile.groupId, connectionProfile.groupId);
		assert.deepStrictEqual(savedProfile.providerName, connectionProfile.providerName);
		assert.strictEqual(savedProfile.savePassword, connectionProfile.savePassword);
		assert.notStrictEqual(connectionProfile.id, undefined);
		assert.strictEqual(savedProfile.id, undefined);
	});

	test('withoutPassword should create a new instance without password', () => {
		let conn = new ConnectionProfile(capabilitiesService, iConnectionProfile);
		assert.notStrictEqual(conn.password, '');
		let withoutPassword = conn.withoutPassword();
		assert.strictEqual(withoutPassword.password, '');
	});

	test('unique id should not include password', () => {
		let conn = new ConnectionProfile(capabilitiesService, iConnectionProfile);
		let withoutPassword = conn.withoutPassword();
		assert.strictEqual(withoutPassword.getOptionsKey(), conn.getOptionsKey());
	});

	test('cloneWithDatabase should create new profile with new id', () => {
		let conn = new ConnectionProfile(capabilitiesService, iConnectionProfile);
		let newProfile = conn.cloneWithDatabase('new db');
		assert.notStrictEqual(newProfile.id, conn.id);
		assert.strictEqual(newProfile.databaseName, 'new db');
	});

	test('an empty connection profile does not cause issues', () => {
		assert.doesNotThrow(() => new ConnectionProfile(capabilitiesService, {} as IConnectionProfile));
	});

	test('getOptionsKey should produce the same optionsKey after converting to IConnectionProfile', () => {
		let conn = new ConnectionProfile(capabilitiesService, iConnectionProfile);
		const myIConnectionProfile = conn.toIConnectionProfile();
		assert.equal(conn.getOptionsKey(), myIConnectionProfile.getOptionsKey());
	});
});
