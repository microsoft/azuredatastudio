/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'azdata';
import * as assert from 'assert';

import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { formatServerNameWithDatabaseNameForAttachTo, getServerFromFormattedAttachToName, getDatabaseFromFormattedAttachToName } from 'sql/workbench/parts/notebook/browser/models/notebookUtils';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

suite('notebookUtils', function (): void {
	let conn: IConnectionProfile = {
		connectionName: '',
		serverName: '',
		databaseName: '',
		userName: '',
		password: '',
		authenticationType: '',
		savePassword: true,
		groupFullName: '',
		groupId: '',
		providerName: mssqlProviderName,
		saveProfile: true,
		id: '',
		options: {},
		azureTenantId: undefined
	};

	test('Should format server and database name correctly for attach to', async function (): Promise<void> {
		let capabilitiesService = new TestCapabilitiesService();
		let connProfile = new ConnectionProfile(capabilitiesService, conn);
		connProfile.serverName = 'serverName';
		connProfile.databaseName = 'databaseName';
		let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
		assert.equal(attachToNameFormatted, 'serverName (databaseName)');
	});

	test('Should format server name correctly for attach to', async function (): Promise<void> {
		let capabilitiesService = new TestCapabilitiesService();
		let connProfile = new ConnectionProfile(capabilitiesService, conn);
		connProfile.serverName = 'serverName';
		let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
		assert.equal(attachToNameFormatted, 'serverName');
	});

	test('Should format server name correctly for attach to when database is undefined', async function (): Promise<void> {
		let capabilitiesService = new TestCapabilitiesService();
		let connProfile = new ConnectionProfile(capabilitiesService, conn);
		connProfile.serverName = 'serverName';
		connProfile.databaseName = undefined;
		let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
		assert.equal(attachToNameFormatted, 'serverName');
	});

	test('Should format server name as empty string when server/database are undefined', async function (): Promise<void> {
		let capabilitiesService = new TestCapabilitiesService();
		let connProfile = new ConnectionProfile(capabilitiesService, conn);
		connProfile.serverName = undefined;
		connProfile.databaseName = undefined;
		let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
		assert.equal(attachToNameFormatted, '');
	});

	test('Should extract server name when no database specified', async function (): Promise<void> {
		let serverName = getServerFromFormattedAttachToName('serverName');
		let databaseName = getDatabaseFromFormattedAttachToName('serverName');
		assert.equal(serverName, 'serverName');
		assert.equal(databaseName, '');
	});

	test('Should extract server and database name', async function (): Promise<void> {
		let serverName = getServerFromFormattedAttachToName('serverName (databaseName)');
		let databaseName = getDatabaseFromFormattedAttachToName('serverName (databaseName)');
		assert.equal(serverName, 'serverName');
		assert.equal(databaseName, 'databaseName');
	});

	test('Should extract server and database name with other parentheses', async function (): Promise<void> {
		let serverName = getServerFromFormattedAttachToName('serv()erName (databaseName)');
		let databaseName = getDatabaseFromFormattedAttachToName('serv()erName (databaseName)');
		assert.equal(serverName, 'serv()erName');
		assert.equal(databaseName, 'databaseName');
	});
});
