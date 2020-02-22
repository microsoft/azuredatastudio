/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConnectionService, IConnectionProvider, IProviderConnectionCompleteEvent, IProviderConnectionChangedEvent, ConnectionState } from 'sql/platform/connection/common/connectionService';
import { NullLogService } from 'vs/platform/log/common/log';
import { Emitter } from 'vs/base/common/event';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { CapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesServiceImpl';

const options: { [key: string]: any } = {
	serverName: 'testServer',
	databaseName: 'testdatabase',
	userName: 'testuser',
	password: 'testpassword'
};

suite('Connection Service', () => {
	test('does connect', async () => {
		const capabilitiesService = new CapabilitiesService();
		const provider = new TestConnectionProvider();
		capabilitiesService.registerConnectionProvider(TestConnectionProvider.ID, TestConnectionProvider.properties);
		const connectionService = new ConnectionService(capabilitiesService, new NullLogService());
		connectionService.registerProvider(provider);
		const connectStub = sinon.stub(provider, 'connect', (connectionUri: string, options: { [name: string]: any; }) => {
			return Promise.resolve(true);
		});

		const connection = connectionService.createOrGetConnection('someuri', { provider: TestConnectionProvider.ID, options });
		assert(connection.state === ConnectionState.DISCONNECTED);
		const result = await connection.connect();
		assert(result.failed === false);
		assert(result.errorMessage === '');
		assert(connectStub.calledOnce);
	});
});

class TestConnectionProvider implements IConnectionProvider {
	public static readonly ID = 'testConnectionProvider';
	public static readonly properties: ConnectionProviderProperties = {
		providerId: TestConnectionProvider.ID,
		displayName: 'Test Provider',
		connectionOptions: [
			{
				specialValueType: ConnectionOptionSpecialType.serverName,
				name: 'serverName',
				groupName: 'source',
				isRequired: true,
				valueType: ServiceOptionType.string,
				displayName: 'serverName',
				description: 'serverName',
				isIdentity: true
			},
			{
				specialValueType: ConnectionOptionSpecialType.databaseName,
				name: 'databaseName',
				groupName: 'source',
				isRequired: true,
				valueType: ServiceOptionType.string,
				displayName: 'databaseName',
				description: 'databaseName',
				isIdentity: true
			},
			{
				specialValueType: ConnectionOptionSpecialType.userName,
				name: 'userName',
				groupName: 'source',
				isRequired: true,
				valueType: ServiceOptionType.string,
				displayName: 'userName',
				description: 'userName',
				isIdentity: true
			},
			{
				specialValueType: ConnectionOptionSpecialType.password,
				name: 'password',
				groupName: 'source',
				isRequired: true,
				valueType: ServiceOptionType.string,
				displayName: 'password',
				description: 'password',
				isIdentity: true
			}
		]
	};

	public get id() { return TestConnectionProvider.ID; }

	public readonly onDidConnectionCompleteEmitter = new Emitter<IProviderConnectionCompleteEvent>();
	public readonly onDidConnectionComplete = this.onDidConnectionCompleteEmitter.event;

	public readonly onDidConnectionChangedEmitter = new Emitter<IProviderConnectionChangedEvent>();
	public readonly onDidConnectionChanged = this.onDidConnectionChangedEmitter.event;

	connect(connectionUri: string, options: { [name: string]: any; }): Promise<boolean> {
		throw new Error('Method not implemented.');
	}

	disconnect(connectionUri: string): Promise<boolean> {
		throw new Error('Method not implemented.');
	}

	cancelConnect(connectionUri: string): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
}
