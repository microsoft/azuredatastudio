/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import * as ConnectionUtils from 'sql/platform/connection/common/utils';

suite('Connection Utilities tests', () => {
	let capabilitiesService = new TestCapabilitiesService();
	let connection = new ConnectionProfile(capabilitiesService, {
		connectionName: 'Test',
		savePassword: false,
		groupFullName: 'testGroup',
		serverName: 'testServerName',
		databaseName: 'master',
		authenticationType: 'inetgrated',
		password: 'test',
		userName: 'testUsername',
		groupId: undefined,
		providerName: mssqlProviderName,
		options: {},
		saveProfile: true,
		id: 'testID'
	});

	test('findProfileInGroup - test if utils can find profile in group', () => {
		let conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		let conProfGroupChild = new ConnectionProfileGroup('testGroupChild', conProfGroup, 'testGroupChild', undefined, undefined);
		conProfGroup.addGroups([conProfGroupChild]);
		conProfGroupChild.addConnections([connection]);
		assert.equal(connection, ConnectionUtils.findProfileInGroup(connection, [conProfGroup]));
	});

	test('getUriPrefix - test if getUriPrefix finds the correct prefix from fake uri name', () => {
		let testUri = 'test://testpath';
		assert.equal('test://', ConnectionUtils.getUriPrefix(testUri));
		let badTestUri = '://>test#%</';
		assert.equal(ConnectionUtils.uriPrefixes.default, ConnectionUtils.getUriPrefix(badTestUri));
		assert.equal('', ConnectionUtils.getUriPrefix(undefined));

	});


	test('isMaster - test if isMaster recognizes Connection Profile as server connection', () => {
		assert(ConnectionUtils.isMaster(connection));
	});

	test('parseTimeString - test if time is parsed correctly', () => {
		//Should return false if undefined.
		assert(!ConnectionUtils.parseTimeString(undefined));

		let emptyTime = '.';
		//Should return false if there are not 1-2 string parts split by period.
		assert(!ConnectionUtils.parseTimeString(emptyTime));

		let testTime = '28:06:42.12';
		let testTimeInMS = 101202012;
		//should properly return the time in milliseconds.
		assert.equal(testTimeInMS, ConnectionUtils.parseTimeString(testTime));
	});
});
