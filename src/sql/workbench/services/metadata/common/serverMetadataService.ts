/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IServerMetadataService } from 'sql/workbench/services/metadata/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';

export class ServerMetadataService extends Disposable implements IServerMetadataService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.metadata.ServerMetadataProvider>();

	constructor(
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService
	) {
		super();

		this._register(this._connectionManagementService.onConnect(async (e: IConnectionParams) => {
			const ownerUri = e.connectionUri;
			await this.generateServerMetadata(ownerUri);
		}));
	}

	/**
	 * Register a server metadata service provider
	 */
	public registerProvider(providerId: string, provider: azdata.metadata.ServerMetadataProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`An all server metadata provider with ID "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	/**
	 * Unregister a server metadata service provider
	 */
	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	/**
	 * Gets a registered server metadata service provider. An exception is thrown if a provider isn't registered with the specified ID
	 * @param providerId The ID of the registered provider
	 */
	public getProvider(providerId: string): azdata.metadata.ServerMetadataProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}

		throw invalidProvider(providerId);
	}

	/**
	 * Generates all database server metadata in the form of create table scripts for all tables
	 * @param connectionParams Connection params of the server to get metadata for.
	 */
	public async generateServerMetadata(ownerUri: string): Promise<azdata.metadata.GenerateServerMetadataResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.generateServerMetadata(ownerUri);
		}
		else {
			return Promise.resolve({
				success: false
			});
		}
	}

	/**
	 * Gets all database server metadata in the form of create table scripts for all tables in a server
	 * @param ownerUri The URI of the connection to get metadata for
	 */
	public async getServerMetadata(ownerUri: string): Promise<azdata.metadata.GetServerMetadataResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.getServerMetadata(ownerUri);
		}
		else {
			return Promise.resolve({
				success: false,
				scripts: ''
			});
		}
	}
}
