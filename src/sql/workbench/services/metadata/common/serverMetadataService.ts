/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { IServerMetadataService } from 'sql/workbench/services/metadata/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
export class ServerMetadataService extends Disposable implements IServerMetadataService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.metadata.ServerMetadataProvider>();

	constructor(
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IExtensionService private readonly _extensionService: IExtensionService
	) {
		super();

		this._register(this._connectionManagementService.onConnect(async (e: IConnectionParams) => {
			const copilotExt = await this._extensionService.getExtension('github.copilot');

			if (copilotExt && this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').githubCopilotContextualizationEnabled) {
				const ownerUri = e.connectionUri;
				await this.generateServerTableMetadata(ownerUri);
			}
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
	 * Unregister a server metadata service provider.
	 */
	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	/**
	 * Gets a registered server metadata service provider. An exception is thrown if a provider isn't registered with the specified ID.
	 * @param providerId The ID of the registered provider.
	 */
	public getProvider(providerId: string): azdata.metadata.ServerMetadataProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}

		throw invalidProvider(providerId);
	}

	/**
	 * Generates all database server metadata in the form of create table scripts for all tables.
	 * @param ownerUri The URI of the connection to generate metadata for.
	 */
	public async generateServerTableMetadata(ownerUri: string): Promise<boolean> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.generateServerTableMetadata(ownerUri);
		}
		else {
			return Promise.resolve(false);
		}
	}

	/**
	 * Gets all database server metadata in the form of create table scripts for all tables in a server.
	 * @param ownerUri The URI of the connection to get metadata for.
	 */
	public async getServerTableMetadata(ownerUri: string): Promise<azdata.metadata.GetServerTableMetadataResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.getServerTableMetadata(ownerUri);
		}
		else {
			return Promise.resolve({
				scripts: []
			});
		}
	}
}
