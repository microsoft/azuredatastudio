/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import * as assert from 'assert';

import * as azdata from 'azdata';

suite('treeUpdateUtils alterConnection', () => {

	let capabilitiesService: TestCapabilitiesService;

	const testOption1 = {
		name: 'testOption1',
		displayName: 'testOption1',
		description: 'test description',
		groupName: 'test group name',
		valueType: 'string',
		specialValueType: undefined,
		defaultValue: '',
		categoryValues: undefined,
		isIdentity: false,
		isRequired: false
	}

	const testOption2 = {
		name: 'testOption2',
		displayName: 'testOption2',
		description: 'test description',
		groupName: 'test group name',
		valueType: 'number',
		specialValueType: undefined,
		defaultValue: '10',
		categoryValues: undefined,
		isIdentity: false,
		isRequired: false
	}

	const testOption3 = {
		name: 'testOption3',
		displayName: 'testOption3',
		description: 'test description',
		groupName: 'test group name',
		valueType: 'string',
		specialValueType: undefined,
		defaultValue: 'default',
		categoryValues: undefined,
		isIdentity: false,
		isRequired: false
	}

	setup(() => {
		capabilitiesService = new TestCapabilitiesService();
		let mainProvider = capabilitiesService.capabilities[mssqlProviderName];
		let mainProperties = mainProvider.connection;
		let mainOptions = mainProperties.connectionOptions;

		mainOptions.push((testOption1 as azdata.ConnectionOption));
		mainOptions.push((testOption2 as azdata.ConnectionOption));
		mainOptions.push((testOption3 as azdata.ConnectionOption));

		mainProperties.connectionOptions = mainOptions;
		mainProvider.connection = mainProperties;

		capabilitiesService.capabilities['MSSQL'] = mainProvider;
	});

	test('Default properties should not be added to the altered title', async () => {
		let profile1: IConnectionProfile = {
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
			options: { testOption3: 'default', testOption2: '10' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let profile2: IConnectionProfile = {
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
			options: { testOption3: 'nonDefault' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let connectionProfile1 = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2 = new ConnectionProfile(capabilitiesService, profile2);


		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
		connectionProfileGroup.addConnections([connectionProfile1, connectionProfile2]);

		let updatedProfileGroup = TreeUpdateUtils.alterTreeChildrenTitles([connectionProfileGroup]);

		let updatedTitleMap = updatedProfileGroup[0].connections.map(profile => profile.title);

		assert.equal(connectionProfile1.title, updatedTitleMap[0]);
		assert.equal(connectionProfile1.title + ' (testOption3=nonDefault)', updatedTitleMap[1]);
	});

	test('Similar connections should have different titles based on all differing properties', async () => {
		let profile1: IConnectionProfile = {
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
			options: { testOption2: '15', testOption1: 'test string 1', testOption3: 'nonDefault' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let profile2: IConnectionProfile = {
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
			options: { testOption2: '50', testOption1: 'test string 1', testOption3: 'nonDefault' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let profile3: IConnectionProfile = {
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
			options: { testOption2: '15', testOption1: 'test string 2', testOption3: 'nonDefault' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let profile4: IConnectionProfile = {
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
			options: { testOption2: '50', testOption1: 'test string 2', testOption3: 'nonDefault' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let defaultProfile: IConnectionProfile = {
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
			options: { testOption3: 'nonDefault' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let defaultConnectionProfile = new ConnectionProfile(capabilitiesService, defaultProfile);
		let connectionProfile1 = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2 = new ConnectionProfile(capabilitiesService, profile2);
		let connectionProfile3 = new ConnectionProfile(capabilitiesService, profile3);
		let connectionProfile4 = new ConnectionProfile(capabilitiesService, profile4);


		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
		let originalTitle = defaultConnectionProfile.title;
		connectionProfileGroup.addConnections([defaultConnectionProfile, connectionProfile1, connectionProfile2, connectionProfile3, connectionProfile4]);

		let updatedProfileGroup = TreeUpdateUtils.alterTreeChildrenTitles([connectionProfileGroup]);

		let updatedTitleMap = updatedProfileGroup[0].connections.map(profile => profile.title);

		assert.equal(originalTitle, updatedTitleMap[0]);
		assert.equal(originalTitle + ' (testOption1=test string 1; testOption2=15)', updatedTitleMap[1]);
		assert.equal(originalTitle + ' (testOption1=test string 1; testOption2=50)', updatedTitleMap[2]);
		assert.equal(originalTitle + ' (testOption1=test string 2; testOption2=15)', updatedTitleMap[3]);
		assert.equal(originalTitle + ' (testOption1=test string 2; testOption2=50)', updatedTitleMap[4]);
	});

	test('identical connections should have same title if on different levels', async () => {
		let profile1: IConnectionProfile = {
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

		let profile2: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3-1',
			groupId: 'g3-1',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let profile3: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3-2',
			groupId: 'g3-2',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let connectionProfile1 = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2 = new ConnectionProfile(capabilitiesService, profile2);
		let connectionProfile3 = new ConnectionProfile(capabilitiesService, profile3);

		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
		let childConnectionProfileGroup = new ConnectionProfileGroup('g3-1', undefined, 'g3-1', undefined, undefined);
		let grandChildConnectionProfileGroup = new ConnectionProfileGroup('g3-2', undefined, 'g3-2', undefined, undefined);
		childConnectionProfileGroup.addConnections([connectionProfile2]);
		connectionProfileGroup.addConnections([connectionProfile1]);
		grandChildConnectionProfileGroup.addConnections([connectionProfile3]);
		childConnectionProfileGroup.addGroups([grandChildConnectionProfileGroup]);
		connectionProfileGroup.addGroups([childConnectionProfileGroup]);

		let updatedProfileGroup = TreeUpdateUtils.alterTreeChildrenTitles([connectionProfileGroup]);

		let updatedTitleMap = updatedProfileGroup[0].connections.map(profile => profile.title);
		let updatedChildTitleMap = updatedProfileGroup[0].children[0].connections.map(profile => profile.title);
		let updatedGrandChildTitleMap = updatedProfileGroup[0].children[0].children[0].connections.map(profile => profile.title);

		// Titles should be the same if they're in different levels.
		assert.equal(updatedTitleMap[0], updatedChildTitleMap[0]);
		assert.equal(updatedTitleMap[0], updatedGrandChildTitleMap[0]);
		assert.equal(updatedChildTitleMap[0], updatedGrandChildTitleMap[0]);
	});
	//TODO - Need to add more test scenarios for alterTreeChildrenTitles in depth.
});
