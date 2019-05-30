/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as mssql from '../../mssql/src/api/mssqlapis';
import * as utils from './utils';
import { context } from './testContext';
import assert = require('assert');
import { getStandaloneServer, TestServerProfile, getBdcServer } from './testConfig';

let cmsService: mssql.CmsService;
let server: TestServerProfile;
let connectionId: string;
let ownerUri: string;
const SERVER_CONNECTION_TIMEOUT: number = 3000;

if (context.RunTest) {
	suite('CMS integration test suite', () => {

		setup(async function () {
			// Set up CMS provider
			if (!cmsService) {
				let api: mssql.MssqlExtensionApi = vscode.extensions.getExtension('Microsoft.mssql').exports;
				cmsService = await api.getCmsServiceProvider();
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
			let failedResult = await cmsService.createCmsServer(undefined, 'test_description', undefined, ownerUri);
			assert(failedResult === undefined, 'Cannot add a CMS server without a name or connection');

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

			// Should create a CMS Server
			let result = await cmsService.createCmsServer('test_cms', 'test_description', connection, ownerUri);
			assert(result !== undefined, 'CMS server created successfully');
		});

		test('Add and delete registered group to/from CMS server', async function () {
			// Should fail
			let failedResult = await cmsService.addServerGroup(ownerUri, '', undefined, 'test_description');
			assert(failedResult === undefined, 'Cannot add a server group without a name');

			// Should create a server group
			let result = await cmsService.addServerGroup(ownerUri, '', 'test_group', 'test_description');
			assert(result === true, 'Server group added to CMS server successfully');

			// Shouldn't be able to create a new server group with same name
			let repeatResult = await cmsService.addServerGroup(ownerUri, '', 'test_group', 'test_description');
			assert(repeatResult === undefined, 'Cannot add a server group with existing name');

			let cmsResources = await cmsService.getRegisteredServers(ownerUri, '');
			assert(cmsResources.registeredServerGroups.length === 1, 'A server group was added successfully');

			// Should remove the server group we added above
			let deleteResult = await cmsService.removeServerGroup(ownerUri, '', 'test_group');
			assert(deleteResult === true, 'Server group removed from CMS server successfully');

			cmsResources = await cmsService.getRegisteredServers(ownerUri, '');
			assert(cmsResources.registeredServerGroups.length === 0, 'The server group was removed successfully');
		});

		test('Add and delete registered server to/from CMS server', async function () {
			// Should fail
			let failedResult = await cmsService.addRegisteredServer(ownerUri, '', undefined, 'test_description', undefined);
			assert(failedResult === undefined, 'Cannot add a registered without a name or connection');

			let bdcServer = await getBdcServer();
			let bdcConnection = {
				serverName: bdcServer.serverName,
				userName: bdcServer.userName,
				password: bdcServer.password,
				authenticationType: bdcServer.authenticationTypeName,
				database: bdcServer.database,
				provider: bdcServer.provider,
				version: bdcServer.version,
				engineType: bdcServer.engineType,
				options: { }
			};

			// Should create a registered server
			let result = await cmsService.addRegisteredServer(ownerUri, '', 'test_registered_server', 'test_description', bdcConnection);
			assert(result === true, 'Registered server added to CMS server successfully');

			// Shouldn't be able to create a new registered server with same name
			let repeatResult = await cmsService.addRegisteredServer(ownerUri, '', 'test_registered_server', 'test_description', bdcConnection);
			assert(repeatResult === undefined, 'Cannot add a registered server with existing name');

			// Should remove the registered server we added above
			let deleteResult = await cmsService.removeRegisteredServer(ownerUri, '', 'test_registered_server');
			assert(deleteResult === true, 'Registered server added to CMS server successfully');
		});

		test('Add and delete registered server to/from server group', async function () {

			// Should create a server group
			let result = await cmsService.addServerGroup(ownerUri, '', 'test_group', 'test_description');
			assert(result === true, 'Server group added to CMS server successfully');

			// Make sure server group is created
			let cmsResources = await cmsService.getRegisteredServers(ownerUri, '');
			assert(cmsResources.registeredServerGroups.length === 1, 'The server group was added successfully');

			// Should create a registered server under the group
			let bdcServer = await getBdcServer();
			let bdcConnection = {
				serverName: bdcServer.serverName,
				userName: bdcServer.userName,
				password: bdcServer.password,
				authenticationType: bdcServer.authenticationTypeName,
				database: bdcServer.database,
				provider: bdcServer.provider,
				version: bdcServer.version,
				engineType: bdcServer.engineType,
				options: { }
			};
			let relativePath = cmsResources.registeredServerGroups[0].relativePath;
			result = await cmsService.addRegisteredServer(ownerUri, relativePath, 'test_registered_server_2', 'test_description', bdcConnection);
			assert(result === true, 'Registered server added to server group');

			// Should remove the server group we added above
			let deleteResult = await cmsService.removeServerGroup(ownerUri, '', 'test_group');
			assert(deleteResult === true, 'Server group deleted from CMS server successfully');
		});
	});
}

