/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile, ConnectionShape } from 'sql/base/common/connectionProfile';
import * as assert from 'assert';
import { isUndefined } from 'vs/base/common/types';

suite('Connection Profile -', () => {
	test('creates from connectionshape', () => {
		const shape: ConnectionShape = {
			authenticationType: 'password',
			providerName: 'MSSQL',
			serverName: 'server'
		};

		const profile = ConnectionProfile.from(shape);

		assert.equal(profile.authenticationType, shape.authenticationType);
		assert.equal(profile.providerName, shape.providerName);
		assert.equal(profile.serverName, shape.serverName);
		assert(isUndefined(profile.databaseName));
		assert(isUndefined(profile.userName));
		assert(isUndefined(profile.connectionName));
	});

	test('creates from connectionprofile', () => {
		const shape: ConnectionShape = {
			authenticationType: 'password2',
			providerName: 'MSSQL1',
			serverName: 'server1'
		};

		const testprofile = ConnectionProfile.from(shape);

		const profile = ConnectionProfile.from(testprofile);

		assert(profile === testprofile);
	});

	test('with connection shape', () => {
		const shape: ConnectionShape = {
			authenticationType: 'password',
			providerName: 'MSSQL',
			serverName: 'server'
		};

		const testprofile = ConnectionProfile.from(shape);

		const shape2: Partial<ConnectionShape> = {
			userName: 'user',
			password: 'password',
			connectionName: 'connection',
			serverName: 'newserver'
		};

		const profile = testprofile.with(shape2);


		assert.equal(profile.authenticationType, shape.authenticationType);
		assert.equal(profile.providerName, shape.providerName);
		assert.equal(profile.serverName, shape2.serverName);
		assert.equal(profile.userName, shape2.userName);
		assert.equal(profile.password, shape2.password);
		assert.equal(profile.connectionName, shape2.connectionName);
	});

	test('to string', () => {
		const shape: ConnectionShape = {
			authenticationType: 'password',
			providerName: 'MSSQL',
			serverName: 'server'
		};

		assert(ConnectionProfile.from(shape).toString(), 'provider:MSSQL;serverName:server');

		shape.databaseName = 'database2';

		assert(ConnectionProfile.from(shape), 'provider:MSSQL;serverName:server;databaseName:database2');

		shape.userName = 'username2';
		assert(ConnectionProfile.from(shape), 'provider:MSSQL;serverName:server;databaseName:database2;userName:username2;');
	});
});
