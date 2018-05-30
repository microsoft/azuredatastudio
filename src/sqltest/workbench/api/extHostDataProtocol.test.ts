/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { Mock } from 'typemoq';
import * as sqlops from 'sqlops';
import { ExtHostDataProtocol } from 'sql/workbench/api/node/extHostDataProtocol';
import { DataProviderType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ProxyAuthHandler } from 'vs/code/electron-main/auth';
import { MainThreadDataProtocolShape } from 'sql/workbench/api/node/sqlExtHost.protocol';

suite('ExtHostDataProtocol', () => {

	let extHostDataProtocol: ExtHostDataProtocol;

	setup(() => {
		extHostDataProtocol = new ExtHostDataProtocol({
			getProxy: identifier => {
				return {
					$registerMetadataProvider: (providerId, handle) => Promise.resolve(),
					$registerConnectionProvider: (providerId, handle) => Promise.resolve()
				} as any;
			}
		} as any);
	});

	test('Providers are exposed to other extensions', () => {
		let extension1Id = 'provider1';
		let extension1MetadataMock = Mock.ofInstance({
			getMetadata: () => undefined,
			getDatabases: () => undefined,
			getTableInfo: () => undefined,
			getViewInfo: () => undefined,
			providerId: extension1Id
		} as sqlops.MetadataProvider);

		let extension2Id = 'provider2';
		let extension2MetadataMock = Mock.ofInstance({
			getMetadata: () => undefined,
			getDatabases: () => undefined,
			getTableInfo: () => undefined,
			getViewInfo: () => undefined,
			providerId: extension2Id
		} as sqlops.MetadataProvider);

		// If I register both providers and then get them using the getProvider API
		extHostDataProtocol.$registerMetadataProvider(extension1MetadataMock.object);
		extHostDataProtocol.$registerMetadataProvider(extension2MetadataMock.object);
		extHostDataProtocol.$registerConnectionProvider({} as sqlops.ConnectionProvider);
		let retrievedProvider1 = extHostDataProtocol.getProvider<sqlops.MetadataProvider>(extension1Id, DataProviderType.MetadataProvider);
		let retrievedProvider2 = extHostDataProtocol.getProvider<sqlops.MetadataProvider>(extension2Id, DataProviderType.MetadataProvider);
		let allProviders = extHostDataProtocol.getProvidersByType<sqlops.MetadataProvider>(DataProviderType.MetadataProvider);

		// Then each provider was retrieved successfully
		assert.equal(retrievedProvider1, extension1MetadataMock.object, 'Expected metadata provider was not retrieved for extension 1');
		assert.equal(retrievedProvider2, extension2MetadataMock.object, 'Expected metadata provider was not retrieved for extension 2');
		assert.equal(allProviders.length, 2, 'All metadata providers had unexpected length');
		assert.equal(allProviders.some(provider => provider === extension1MetadataMock.object), true, 'All metadata providers did not include extension 1 metadata provider');
		assert.equal(allProviders.some(provider => provider === extension2MetadataMock.object), true, 'All metadata providers did not include extension 2 metadata provider');
	});
});
