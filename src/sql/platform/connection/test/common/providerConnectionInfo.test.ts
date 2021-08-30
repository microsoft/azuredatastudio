/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProviderConnectionInfo } from 'sql/platform/connection/common/providerConnectionInfo';
import { IConnectionProfile, ConnectionOptionSpecialType, ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import * as azdata from 'azdata';
import * as assert from 'assert';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

suite('SQL ProviderConnectionInfo tests', () => {
	let msSQLCapabilities: any;
	let capabilitiesService: TestCapabilitiesService;

	let connectionProfile: IConnectionProfile = {
		connectionName: 'name',
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
		providerName: mssqlProviderName,
		options: undefined!,
		saveProfile: true,
		id: undefined!
	};

	setup(() => {
		let capabilities: azdata.DataProtocolServerCapabilities[] = [];
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
			},
			{
				name: 'encrypt',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: false,
				isRequired: false,
				specialValueType: undefined!,
				valueType: ServiceOptionType.string
			}
		];
		msSQLCapabilities = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: connectionProvider,
		};
		capabilities.push(msSQLCapabilities);
		capabilitiesService = new TestCapabilitiesService();
		capabilitiesService.capabilities[mssqlProviderName] = { connection: msSQLCapabilities };
	});

	test('constructor should accept undefined parameters', () => {
		let conn = new ProviderConnectionInfo(undefined!, undefined!);
		assert.strictEqual(conn.serverName, undefined);
	});

	test('set properties should set the values correctly', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, mssqlProviderName);
		assert.strictEqual(conn.serverName, undefined);
		conn.connectionName = connectionProfile.connectionName!;
		conn.serverName = connectionProfile.serverName;
		conn.databaseName = connectionProfile.databaseName!;
		conn.authenticationType = connectionProfile.authenticationType;
		conn.password = connectionProfile.password;
		conn.userName = connectionProfile.userName;
		assert.strictEqual(conn.connectionName, connectionProfile.connectionName);
		assert.strictEqual(conn.serverName, connectionProfile.serverName);
		assert.strictEqual(conn.databaseName, connectionProfile.databaseName);
		assert.strictEqual(conn.authenticationType, connectionProfile.authenticationType);
		assert.strictEqual(conn.password, connectionProfile.password);
		assert.strictEqual(conn.userName, connectionProfile.userName);
	});

	test('set properties should store the values in the options', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, mssqlProviderName);
		assert.strictEqual(conn.serverName, undefined);
		conn.serverName = connectionProfile.serverName;
		conn.databaseName = connectionProfile.databaseName!;
		conn.authenticationType = connectionProfile.authenticationType;
		conn.password = connectionProfile.password;
		conn.userName = connectionProfile.userName;
		assert.strictEqual(conn.getOptionValue('serverName'), connectionProfile.serverName);
		assert.strictEqual(conn.getOptionValue('databaseName'), connectionProfile.databaseName);
		assert.strictEqual(conn.getOptionValue('authenticationType'), connectionProfile.authenticationType);
		assert.strictEqual(conn.getOptionValue('password'), connectionProfile.password);
		assert.strictEqual(conn.getOptionValue('userName'), connectionProfile.userName);
	});

	test('constructor should initialize the options given a valid model', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);

		assert.strictEqual(conn.connectionName, connectionProfile.connectionName);
		assert.strictEqual(conn.serverName, connectionProfile.serverName);
		assert.strictEqual(conn.databaseName, connectionProfile.databaseName);
		assert.strictEqual(conn.authenticationType, connectionProfile.authenticationType);
		assert.strictEqual(conn.password, connectionProfile.password);
		assert.strictEqual(conn.userName, connectionProfile.userName);
	});

	test('clone should create a new instance that equals the old one', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);

		let conn2 = conn.clone();
		assert.strictEqual(conn.connectionName, conn2.connectionName);
		assert.strictEqual(conn.serverName, conn2.serverName);
		assert.strictEqual(conn.databaseName, conn2.databaseName);
		assert.strictEqual(conn.authenticationType, conn2.authenticationType);
		assert.strictEqual(conn.password, conn2.password);
		assert.strictEqual(conn.userName, conn2.userName);
	});

	test('Changing the cloned object should not change the original one', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);

		let conn2 = conn.clone();
		conn2.serverName = conn.serverName + '1';
		assert.notEqual(conn.serverName, conn2.serverName);
	});

	test('constructor should initialize the options given a valid model with options', () => {
		let options: { [key: string]: string } = {};
		options['encrypt'] = 'test value';
		let conn2 = Object.assign({}, connectionProfile, { options: options });
		let conn = new ProviderConnectionInfo(capabilitiesService, conn2);

		assert.strictEqual(conn.connectionName, conn2.connectionName);
		assert.strictEqual(conn.serverName, conn2.serverName);
		assert.strictEqual(conn.databaseName, conn2.databaseName);
		assert.strictEqual(conn.authenticationType, conn2.authenticationType);
		assert.strictEqual(conn.password, conn2.password);
		assert.strictEqual(conn.userName, conn2.userName);
		assert.strictEqual(conn.options['encrypt'], 'test value');
	});

	test('getOptionsKey should create a valid unique id', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let expectedId = 'providerName:MSSQL|authenticationType:|databaseName:database|serverName:new server|userName:user';
		let id = conn.getOptionsKey();
		assert.strictEqual(id, expectedId);
	});

	test('getOptionsKey should create different id for different server names', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let conn2 = new ProviderConnectionInfo(capabilitiesService, Object.assign({}, connectionProfile, { serverName: connectionProfile.serverName + '1' }));

		assert.notEqual(conn.getOptionsKey(), conn2.getOptionsKey());
	});

	test('titleParts should return server, database and auth type as first items', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let titleParts = conn.titleParts;
		assert.strictEqual(titleParts.length, 4);
		assert.strictEqual(titleParts[0], connectionProfile.serverName);
		assert.strictEqual(titleParts[1], connectionProfile.databaseName);
		assert.strictEqual(titleParts[2], connectionProfile.authenticationType);
		assert.strictEqual(titleParts[3], connectionProfile.userName);
	});

	test('getProviderFromOptionsKey should return the provider name from the options key successfully', () => {
		let optionsKey = `providerName:${mssqlProviderName}|authenticationType:|databaseName:database|serverName:new server|userName:user`;
		let actual = ProviderConnectionInfo.getProviderFromOptionsKey(optionsKey);

		assert.strictEqual(mssqlProviderName, actual);
	});

	test('getProviderFromOptionsKey should return empty string give null', () => {
		let optionsKey = undefined!;
		let expectedProviderId: string = '';
		let actual = ProviderConnectionInfo.getProviderFromOptionsKey(optionsKey);

		assert.strictEqual(expectedProviderId, actual);
	});

	test('getProviderFromOptionsKey should return empty string give key without provider name', () => {
		let optionsKey = 'providerName2:MSSQL|authenticationType:|databaseName:database|serverName:new server|userName:user';
		let expectedProviderId: string = '';
		let actual = ProviderConnectionInfo.getProviderFromOptionsKey(optionsKey);

		assert.strictEqual(expectedProviderId, actual);
	});
});
