/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as mssql from '../../../mssql';
import * as utils from './utils';
import * as uuid from './uuid';
import assert = require('assert');
import { getStandaloneServer, TestServerProfile } from './testConfig';

let cmsService: mssql.ICmsService;
let server: TestServerProfile;
let connectionId: string;
let ownerUri: string;
const SERVER_CONNECTION_TIMEOUT: number = 3000;
const TEST_CMS_NAME = `adsTestCms_${uuid.v4().asHex()}`;
const TEST_CMS_GROUP = `adsTestCmsGroup_${uuid.v4().asHex()}`;
const TEST_CMS_SERVER = `adsTestCmsServer_${uuid.v4().asHex()}`;
const TEST_CMS_REG_SERVER = `adsTestCmsRegisteredServer_${uuid.v4().asHex()}`;

suite('CMS integration test suite', () => {

	setup(async function () {
		// Set up CMS provider
		if (!cmsService) {
			cmsService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).cmsService;
			assert(cmsService !== undefined);
		}

		// Set up connection
		if (!server) {
			server = await getStandaloneServer();
			connectionId = await utils.connectToServer(server, SERVER_CONNECTION_TIMEOUT);
			ownerUri = await azdata.connection.getConnectionString(connectionId, true);
			console.log('Start CMS tests');
		}
		if (!ownerUri) {
			ownerUri = await azdata.connection.getConnectionString(connectionId, true);
		}
	});

	test('Create CMS Server', async function () {
		// Should fail
		await utils.assertThrowsAsync(
			async () => await cmsService.createCmsServer(undefined, 'test_description', undefined, ownerUri),
			'Cannot add a CMS server without a name or connection');
		let connection = {
			serverName: server.serverName,
			userName: server.userName,
			password: server.password,
			authenticationType: server.authenticationTypeName,
			database: server.database,
			provider: server.provider,
			version: server.version,
			engineType: server.engineType,
			options: {}
		};

		// Should create a CMS Server without an error
		await cmsService.createCmsServer(TEST_CMS_NAME, 'test_description', connection, ownerUri);
	});

	test('Add and delete registered group to/from CMS server', async function () {
		await utils.assertThrowsAsync(
			async () => await cmsService.addServerGroup(ownerUri, '', undefined, 'test_description'),
			'Cannot add a server group without a name');

		// Should create a server group
		let result = await cmsService.addServerGroup(ownerUri, '', TEST_CMS_GROUP, 'test_description');
		assert(result === true, `Server group ${TEST_CMS_GROUP} was not added to CMS server successfully`);

		let existingRegisteredServerGroupCount = (await cmsService.getRegisteredServers(ownerUri, '')).registeredServerGroups.length;

		// Shouldn't be able to create a new server group with same name
		await utils.assertThrowsAsync(
			async () => await cmsService.addServerGroup(ownerUri, '', TEST_CMS_GROUP, 'test_description'),
			'Cannot add a server group with existing name');

		let cmsResources = await cmsService.getRegisteredServers(ownerUri, '');
		assert(cmsResources.registeredServerGroups.length === existingRegisteredServerGroupCount,
			`Unexpected number of Registered Server Groups after attempting to add group that already exists. Groups : [${cmsResources.registeredServerGroups.map(g => g.name).join(', ')}]`);

		// Should remove the server group we added above
		let deleteResult = await cmsService.removeServerGroup(ownerUri, '', TEST_CMS_GROUP);
		assert(deleteResult === true, `Server group ${TEST_CMS_GROUP} was not removed successfully`);

		cmsResources = await cmsService.getRegisteredServers(ownerUri, '');
		assert(cmsResources.registeredServerGroups.find(g => g.name === TEST_CMS_GROUP) === undefined,
			`The server group ${TEST_CMS_GROUP} was not removed successfully. Groups : [${cmsResources.registeredServerGroups.map(g => g.name).join(', ')}]`);
	});

	test('Add and delete registered server to/from CMS server', async function () {

		await utils.assertThrowsAsync(
			async () => cmsService.addRegisteredServer(ownerUri, '', undefined, 'test_description', undefined),
			'Cannot add a registered without a name or connection');

		let server = await getStandaloneServer('2019');
		let connection = {
			serverName: server.serverName,
			userName: server.userName,
			password: server.password,
			authenticationType: server.authenticationTypeName,
			database: server.database,
			provider: server.provider,
			version: server.version,
			engineType: server.engineType,
			options: {}
		};

		// Should create a registered server
		let result = await cmsService.addRegisteredServer(ownerUri, '', TEST_CMS_SERVER, 'test_description', connection);
		assert(result === true, `Registered server ${TEST_CMS_SERVER} was not added to CMS server successfully`);

		// Shouldn't be able to create a new registered server with same name
		await utils.assertThrowsAsync(
			async () => await cmsService.addRegisteredServer(ownerUri, '', TEST_CMS_SERVER, 'test_description', connection),
			'Cannot add a registered server with existing name');

		// Should remove the registered server we added above
		let deleteResult = await cmsService.removeRegisteredServer(ownerUri, '', TEST_CMS_SERVER);
		assert(deleteResult === true, `Registered server ${TEST_CMS_SERVER} was not removed correctly`);
	});

	test('Add and delete registered server to/from server group', async function () {

		// Should create a server group
		let result = await cmsService.addServerGroup(ownerUri, '', TEST_CMS_GROUP, 'test_description');
		assert(result === true, `Server group ${TEST_CMS_GROUP} was not created successfully`);

		// Make sure server group is created
		let cmsResources = await cmsService.getRegisteredServers(ownerUri, '');
		assert(cmsResources.registeredServerGroups.find(g => g.name === TEST_CMS_GROUP),
			`Registered Server Group ${TEST_CMS_GROUP} was not found after being added. Groups : [${cmsResources.registeredServerGroups.map(g => g.name).join(', ')}]`);

		// Should create a registered server under the group
		let server = await getStandaloneServer('2019');
		let connection = {
			serverName: server.serverName,
			userName: server.userName,
			password: server.password,
			authenticationType: server.authenticationTypeName,
			database: server.database,
			provider: server.provider,
			version: server.version,
			engineType: server.engineType,
			options: {}
		};
		let relativePath = cmsResources.registeredServerGroups[0].relativePath;

		result = await cmsService.addRegisteredServer(ownerUri, relativePath, TEST_CMS_REG_SERVER, 'test_description', connection);
		assert(result === true, `Registered server ${TEST_CMS_REG_SERVER} was not added to server group successfully`);

		// Should remove the server group we added above
		let deleteResult = await cmsService.removeServerGroup(ownerUri, '', TEST_CMS_GROUP);
		assert(deleteResult === true, `Server group ${TEST_CMS_GROUP} was not deleted from CMS server successfully`);
	});
});
