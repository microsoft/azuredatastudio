/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IAllServerMetadataService } from 'sql/workbench/services/metadata/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';

export class AllServerMetadataService extends Disposable implements IAllServerMetadataService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.metadata.AllServerMetadataProvider>();

	constructor(
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService
	) {
		super();

		this._register(this._connectionManagementService.onConnect(async (e) => await this.getAllServerMetadata(e)));
	}

	/**
	 * Register an all server metadata service provider
	 */
	public registerProvider(providerId: string, provider: azdata.metadata.AllServerMetadataProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`An all server metadata provider with ID "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	/**
	 * Unregister an all server metadata service provider
	 */
	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	/**
	 * Gets a registered all server metadata service provider. An exception is thrown if a provider isn't registered with the specified ID
	 * @param providerId The ID of the registered provider
	 */
	public getProvider(providerId: string): azdata.metadata.AllServerMetadataProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}

		throw invalidProvider(providerId);
	}

	/**
	 * Gets all database server metadata in the form of create table scripts for all tables
	 * @param connectionParams Connection params of the server to get metadata for.
	 */
	public async getAllServerMetadata(connectionParams: IConnectionParams): Promise<azdata.metadata.AllServerMetadataResult> {
		const providerName = connectionParams.connectionProfile.providerName;
		const handler = this.getProvider(providerName);
		if (handler) {
			const ownerUri = connectionParams.connectionUri;
			return await handler.getAllServerMetadata(ownerUri);
		}
		else {
			return Promise.resolve({
				scripts: ''
			});
		}
	}
}
