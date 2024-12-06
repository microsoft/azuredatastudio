/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
		serverCapabilities: undefined,
		getOptionsKey: undefined!,
		getOptionKeyIdNames: undefined!,
		matches: undefined!,
		providerName: mssqlProviderName,
		options: undefined!,
		saveProfile: true,
		id: undefined!
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
				defaultValue: undefined!,
				objectType: undefined,
				isArray: false,
				isIdentity: false,
				isRequired: false,
				showOnConnectionDialog: true,
				specialValueType: undefined!,
				valueType: ServiceOptionType.string
			}
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
		assert.notStrictEqual(conn.serverName, conn2.serverName);
	});

	test('constructor should initialize the options given a valid model with options', () => {
		let options: { [key: string]: string } = {};
		options['encrypt'] = 'true';
		let conn2 = Object.assign({}, connectionProfile, { options: options });
		let conn = new ProviderConnectionInfo(capabilitiesService, conn2);

		assert.strictEqual(conn.connectionName, conn2.connectionName);
		assert.strictEqual(conn.serverName, conn2.serverName);
		assert.strictEqual(conn.databaseName, conn2.databaseName);
		assert.strictEqual(conn.authenticationType, conn2.authenticationType);
		assert.strictEqual(conn.password, conn2.password);
		assert.strictEqual(conn.userName, conn2.userName);
		assert.strictEqual(conn.options['encrypt'], 'true');
	});

	test('constructor should initialize the options with encrypt strict', () => {
		let options: { [key: string]: string } = {};
		options['encrypt'] = 'strict';
		let conn2 = Object.assign({}, connectionProfile, { options: options });
		let conn = new ProviderConnectionInfo(capabilitiesService, conn2);

		assert.strictEqual(conn.connectionName, conn2.connectionName);
		assert.strictEqual(conn.serverName, conn2.serverName);
		assert.strictEqual(conn.databaseName, conn2.databaseName);
		assert.strictEqual(conn.authenticationType, conn2.authenticationType);
		assert.strictEqual(conn.password, conn2.password);
		assert.strictEqual(conn.userName, conn2.userName);
		assert.strictEqual(conn.options['encrypt'], 'strict');
	});

	test('getOptionsKey should create a valid unique id', () => {
		// Test the new option key format
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let expectedId = 'providerName:MSSQL|authenticationType:|connectionName:name|databaseName:database|serverName:new server|userName:user';
		let id = conn.getOptionsKey();
		assert.strictEqual(id, expectedId);

		// Test for original options key (used for retrieving passwords and as a fallback for unsupported providers)
		// **IMPORTANT** The original format option key should NEVER change without thorough review and consideration of side effects. This version of the key controls
		//				 things like how passwords are saved, which means if its changed then serious side effects will occur.
		expectedId = 'providerName:MSSQL|authenticationType:|databaseName:database|serverName:new server|userName:user';
		id = conn.getOptionsKey(true);
		assert.strictEqual(id, expectedId);
	});

	test('getOptionsKey should return original formatted ID if useFullOptions is not supported', () => {
		// Test the new option key format
		let originalCapabilitiesConnection = capabilitiesService.capabilities[mssqlProviderName].connection;
		originalCapabilitiesConnection.useFullOptions = false;
		let newCapabilitiesService = new TestCapabilitiesService();
		newCapabilitiesService.capabilities[mssqlProviderName] = { connection: originalCapabilitiesConnection }
		let conn = new ProviderConnectionInfo(newCapabilitiesService, connectionProfile);
		let expectedId = 'providerName:MSSQL|authenticationType:|databaseName:database|serverName:new server|userName:user';
		let id = conn.getOptionsKey();
		assert.strictEqual(id, expectedId);

		// Should be the same when getOriginalOptions is true.
		id = conn.getOptionsKey(true);
		assert.strictEqual(id, expectedId);
	});

	test('getOptionsKey should create different keys based on optional options', () => {
		const conn1 = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let id1 = conn1.getOptionsKey();

		connectionProfile.options = {
			'encrypt': true
		};
		const conn2 = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		const id2 = conn2.getOptionsKey();

		assert.notEqual(id1, id2);
	});

	test('getOptionsKey should have the same key if original options is used', () => {
		const conn1 = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let id1 = conn1.getOptionsKey(true);

		connectionProfile.options = {
			'encrypt': true
		};
		const conn2 = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		const id2 = conn2.getOptionsKey(true);

		assert.strictEqual(id1, id2);
	});

	test('getOptionsKey should create different id for different server names', () => {
		let conn = new ProviderConnectionInfo(capabilitiesService, connectionProfile);
		let conn2 = new ProviderConnectionInfo(capabilitiesService, Object.assign({}, connectionProfile, { serverName: connectionProfile.serverName + '1' }));

		assert.notStrictEqual(conn.getOptionsKey(), conn2.getOptionsKey());
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
