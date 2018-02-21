/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import { ConnectionStatusManager } from 'sql/parts/connection/common/connectionStatusManager';
import * as Utils from 'sql/parts/connection/common/utils';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';

let connections: ConnectionStatusManager;
let capabilitiesService: CapabilitiesTestService;
let connectionProfileObject: ConnectionProfile;
let connectionProfile: IConnectionProfile = {
	serverName: 'new server',
	databaseName: 'database',
	userName: 'user',
	password: 'password',
	authenticationType: '',
	savePassword: true,
	groupFullName: 'g2/g2-2',
	groupId: 'group id',
	getOptionsKey: () => 'connection1',
	matches: undefined,
	providerName: 'MSSQL',
	options: {},
	saveProfile: true,
	id: undefined
};
let editorConnectionProfile: IConnectionProfile = {
	serverName: 'new server',
	databaseName: 'database',
	userName: 'user',
	password: 'password',
	authenticationType: '',
	savePassword: true,
	groupFullName: 'g2/g2-2',
	groupId: 'group id',
	getOptionsKey: () => 'connection2',
	matches: undefined,
	providerName: 'MSSQL',
	options: {},
	saveProfile: true,
	id: undefined
};
let connectionProfileWithoutDbName: IConnectionProfile = {
	serverName: 'new server',
	databaseName: '',
	userName: 'user',
	password: 'password',
	authenticationType: '',
	savePassword: true,
	groupFullName: 'g2/g2-2',
	groupId: 'group id',
	getOptionsKey: () => 'connection1',
	matches: undefined,
	providerName: 'MSSQL',
	options: {},
	saveProfile: true,
	id: undefined
};

let connection1Id: string;
let connection2Id: string;
let connection3Id: string;

suite('SQL ConnectionStatusManager tests', () => {
	setup(() => {
		capabilitiesService = new CapabilitiesTestService();
		connectionProfileObject = new ConnectionProfile(capabilitiesService.getCapabilities().find(x => x.providerName === 'MSSQL')
			, connectionProfile);
		connections = new ConnectionStatusManager(capabilitiesService);
		connection1Id = Utils.generateUri(connectionProfile);
		connection2Id = 'connection2Id';
		connection3Id = 'connection3Id';
		connections.addConnection(connectionProfile, connection1Id);
		connections.addConnection(editorConnectionProfile, connection2Id);
		connections.addConnection(connectionProfileWithoutDbName, connection3Id);
	});

	test('findConnection should return undefined given invalid id', () => {
		let id: string = 'invalid id';
		let expected = undefined;
		let actual = connections.findConnection(id);
		assert.equal(actual, expected);
	});

	test('findConnection should return connection given valid id', () => {
		let id: string = connection1Id;
		let expected = connectionProfileObject;
		let actual = connections.findConnection(id);
		assert.deepEqual(actual.connectionProfile, expected);
	});

	test('getConnectionProfile should return undefined given invalid id', () => {
		let id: string = 'invalid id';
		let expected = undefined;
		let actual = connections.getConnectionProfile(id);
		assert.equal(actual, expected);
	});

	test('getConnectionProfile should return connection given valid id', () => {
		let id: string = connection1Id;
		let expected = connectionProfileObject;
		let actual = connections.getConnectionProfile(id);
		assert.deepEqual(actual, expected);
	});

	test('hasConnection should return false given invalid id', () => {
		let id: string = 'invalid id';
		let expected = false;
		let actual = connections.hasConnection(id);
		assert.equal(actual, expected);
	});

	test('hasConnection should return true given valid id', () => {
		let id: string = connection1Id;
		let expected = true;
		let actual = connections.hasConnection(id);
		assert.equal(actual, expected);
	});

	test('addConnection should set connecting to true', () => {
		let expected = true;
		let summary: sqlops.ConnectionInfoSummary = {
			ownerUri: connection1Id,
			connectionId: connection1Id,
			messages: undefined,
			errorMessage: undefined,
			errorNumber: undefined,
			serverInfo: undefined,
			connectionSummary: undefined
		};
		connections.onConnectionComplete(summary);
		let actual = connections.addConnection(connectionProfile, connection1Id).connecting;
		assert.equal(actual, expected);
	});

	test('onConnectionComplete should set connecting to false', () => {
		let expected = false;
		let summary: sqlops.ConnectionInfoSummary = {
			ownerUri: connection1Id,
			connectionId: connection1Id,
			messages: undefined,
			errorMessage: undefined,
			errorNumber: undefined,
			serverInfo: undefined,
			connectionSummary: undefined
		};
		connections.onConnectionComplete(summary);
		let actual = connections.findConnection(connection1Id).connecting;
		assert.equal(actual, expected);
		actual = connections.isConnecting(connection1Id);
		assert.equal(actual, expected);
	});

	test('updateConnection should update the connection info', () => {
		let expected = connectionProfile.groupId + '1';
		let expectedConnectionId = 'new id';
		connections.addConnection(connectionProfile, connection1Id);

		let updatedConnection = Object.assign({}, connectionProfile, { groupId: expected, getOptionsKey: () => connectionProfile.getOptionsKey() + expected, id: expectedConnectionId });
		let actualId = connections.updateConnectionProfile(updatedConnection, connection1Id);

		let newId = Utils.generateUri(updatedConnection);
		let actual = connections.getConnectionProfile(newId).groupId;
		let actualConnectionId = connections.getConnectionProfile(newId).id;
		assert.equal(actual, expected);
		assert.equal(actualId, newId);
		assert.equal(actualConnectionId, expectedConnectionId);
	});

	test('updateDatabaseName should update the database name in connection', () => {
		let dbName: string = 'db name';
		let summary: sqlops.ConnectionInfoSummary = {
			connectionSummary: {
				databaseName: dbName,
				serverName: undefined,
				userName: undefined
			}
			, ownerUri: connection3Id,
			connectionId: 'connection id',
			errorMessage: undefined,
			errorNumber: undefined,
			messages: undefined,
			serverInfo: undefined
		};

		//The original connection didn't have database name
		let connectionStatus = connections.findConnection(connection3Id);
		connectionStatus.connectionProfile.databaseName = '';

		//Verify database name changed after connection is complete
		connections.updateDatabaseName(summary);
		connectionStatus = connections.findConnection(connection3Id);
		assert.equal(connectionStatus.connectionProfile.databaseName, dbName);
	});

	test('getOriginalOwnerUri should return the original uri given uri with db name', () => {
		let dbName: string = 'db name';
		let summary: sqlops.ConnectionInfoSummary = {
			connectionSummary: {
				databaseName: dbName,
				serverName: undefined,
				userName: undefined
			}
			, ownerUri: connection3Id,
			connectionId: 'connection id',
			errorMessage: undefined,
			errorNumber: undefined,
			messages: undefined,
			serverInfo: undefined
		};

		//The original connection didn't have database name
		let connectionStatus = connections.findConnection(connection3Id);
		connectionStatus.connectionProfile.databaseName = '';

		//Verify database name changed after connection is complete
		connections.updateDatabaseName(summary);
		connectionStatus = connections.findConnection(connection3Id);
		let ownerUriWithDbName = Utils.generateUriWithPrefix(connectionStatus.connectionProfile, 'connection://');

		//The uri assigned to connection without db name should be the original one
		let connectionWitDbStatus = connections.getOriginalOwnerUri(ownerUriWithDbName);
		assert.equal(connectionWitDbStatus, connection3Id);
	});

	test('getOriginalOwnerUri should return given uri if the original uri is the same as the given uri', () => {

		let connectionStatus = connections.getOriginalOwnerUri(connection2Id);
		assert.equal(connectionStatus, connection2Id);
	});

	test('getActiveConnectionProfiles should return a list of all the unique connections that the status manager knows about', () => {
		// Add duplicate connections
		let newConnection = Object.assign({}, connectionProfile);
		newConnection.id = 'test_id';
		newConnection.serverName = 'new_server_name';
		newConnection.options['databaseDisplayName'] = newConnection.databaseName;
		connections.addConnection(newConnection, 'test_uri_1');
		connections.addConnection(newConnection, 'test_uri_2');

		// Get the connections and verify that the duplicate is only returned once
		let activeConnections = connections.getActiveConnectionProfiles();
		assert.equal(activeConnections.length, 4);
		assert.equal(activeConnections.filter(connection => connection.matches(newConnection)).length, 1, 'Did not find newConnection in active connections');
	});
});