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
	};

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
	};

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
	};

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

	test('connections should not affect connections on a different level', async () => {
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
			options: { testOption1: 'value1' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let profile1a: IConnectionProfile = {
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
			options: { testOption1: 'value2' },
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

		let connectionProfile1 = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile1a = new ConnectionProfile(capabilitiesService, profile1a);
		let connectionProfile2 = new ConnectionProfile(capabilitiesService, profile2);

		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);
		let childConnectionProfileGroup = new ConnectionProfileGroup('g3-1', undefined, 'g3-1', undefined, undefined);

		childConnectionProfileGroup.addConnections([connectionProfile2]);
		connectionProfileGroup.addConnections([connectionProfile1, connectionProfile1a]);
		connectionProfileGroup.addGroups([childConnectionProfileGroup]);

		let updatedProfileGroup = TreeUpdateUtils.alterTreeChildrenTitles([connectionProfileGroup]);

		let updatedTitleMap = updatedProfileGroup[0].connections.map(profile => profile.title);
		let updatedChildTitleMap = updatedProfileGroup[0].children[0].connections.map(profile => profile.title);

		// Titles should be altered for the first group only.
		assert.equal(updatedChildTitleMap[0] + ' (testOption1=value1)', updatedTitleMap[0]);
		assert.equal(updatedChildTitleMap[0] + ' (testOption1=value2)', updatedTitleMap[1]);
	});

	test('non default options should only be appended to the connection with non default options', async () => {
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
			groupFullName: 'g3',
			groupId: 'g3',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: { testOption1: 'value1', testOption2: '15' },
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

		//Title for second profile should be the same as the first but with non default options appended.
		assert.equal(updatedTitleMap[0] + ' (testOption1=value1; testOption2=15)', updatedTitleMap[1]);
	});

	test('identical profiles added into one group and separate groups should have the same options appended', async () => {
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
			options: { testOption1: 'value1', testOption2: '15' },
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
			options: { testOption1: 'value2', testOption2: '30' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let connectionProfile1Base = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2Base = new ConnectionProfile(capabilitiesService, profile2);

		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);

		connectionProfileGroup.addConnections([connectionProfile1Base, connectionProfile2Base]);

		profile1.groupFullName = 'g3-1';
		profile1.groupId = 'g3-1';
		profile2.groupFullName = 'g3-1';
		profile2.groupId = 'g3-1';

		let connectionProfile1Child = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2Child = new ConnectionProfile(capabilitiesService, profile2);

		let childConnectionProfileGroup = new ConnectionProfileGroup('g3-1', undefined, 'g3-1', undefined, undefined);

		childConnectionProfileGroup.addConnections([connectionProfile1Child, connectionProfile2Child]);

		profile1.groupFullName = 'g3-2';
		profile1.groupId = 'g3-2';
		profile2.groupFullName = 'g3-2';
		profile2.groupId = 'g3-2';

		let connectionProfile1Grandchild = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2Grandchild = new ConnectionProfile(capabilitiesService, profile2);

		let grandchildConnectionProfileGroup = new ConnectionProfileGroup('g3-2', undefined, 'g3-2', undefined, undefined);

		grandchildConnectionProfileGroup.addConnections([connectionProfile1Grandchild, connectionProfile2Grandchild]);

		childConnectionProfileGroup.addGroups([grandchildConnectionProfileGroup]);

		connectionProfileGroup.addGroups([childConnectionProfileGroup]);

		let updatedProfileGroup = TreeUpdateUtils.alterTreeChildrenTitles([connectionProfileGroup]);

		let updatedTitleMap = updatedProfileGroup[0].connections.map(profile => profile.title);
		let updatedChildTitleMap = updatedProfileGroup[0].children[0].connections.map(profile => profile.title);
		let updatedGrandchildTitleMap = updatedProfileGroup[0].children[0].children[0].connections.map(profile => profile.title);

		//Titles for the same profile in different groups should be identical
		assert.equal(updatedTitleMap[0], updatedChildTitleMap[0]);
		assert.equal(updatedTitleMap[0], updatedGrandchildTitleMap[0]);
		assert.equal(updatedTitleMap[1], updatedChildTitleMap[1]);
		assert.equal(updatedTitleMap[1], updatedGrandchildTitleMap[1]);
	});

	test('profiles in adjacent groups on the same layer should not affect titles on nearby groups', async () => {
		let profile1: IConnectionProfile = {
			serverName: 'server3',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g3a',
			groupId: 'g3a',
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
			groupFullName: 'g3a',
			groupId: 'g3a',
			getOptionsKey: undefined!,
			matches: undefined!,
			providerName: 'MSSQL',
			options: { testOption1: 'value2', testOption2: '30' },
			saveProfile: true,
			id: undefined!,
			connectionName: undefined!
		};

		let connectionProfile1a = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2a = new ConnectionProfile(capabilitiesService, profile2);

		let connectionProfileGroup = new ConnectionProfileGroup('g3', undefined, 'g3', undefined, undefined);

		let childConnectionProfileGroup1 = new ConnectionProfileGroup('g3a', undefined, 'g3a', undefined, undefined);
		childConnectionProfileGroup1.addConnections([connectionProfile1a, connectionProfile2a]);

		profile1.groupFullName = 'g3b';
		profile1.groupId = 'g3b';
		profile2.groupFullName = 'g3b';
		profile2.groupId = 'g3b';

		let connectionProfile1b = new ConnectionProfile(capabilitiesService, profile1);
		let connectionProfile2b = new ConnectionProfile(capabilitiesService, profile2);

		let childConnectionProfileGroup2 = new ConnectionProfileGroup('g3b', undefined, 'g3b', undefined, undefined);

		childConnectionProfileGroup2.addConnections([connectionProfile1b, connectionProfile2b]);

		connectionProfileGroup.addGroups([childConnectionProfileGroup1]);

		connectionProfileGroup.addGroups([childConnectionProfileGroup2]);

		let updatedProfileGroup = TreeUpdateUtils.alterTreeChildrenTitles([connectionProfileGroup]);

		let updatedChildATitleMap = updatedProfileGroup[0].children[0].connections.map(profile => profile.title);
		let updatedChildBTitleMap = updatedProfileGroup[0].children[1].connections.map(profile => profile.title);

		//Check that titles are generated properly for the first group.
		assert.equal(updatedChildATitleMap[0] + ' (testOption1=value2; testOption2=30)', updatedChildATitleMap[1]);

		//Titles for the same profile in adjacent groups should be identical
		assert.equal(updatedChildATitleMap[0], updatedChildBTitleMap[0]);
		assert.equal(updatedChildATitleMap[1], updatedChildBTitleMap[1]);
	});
});
