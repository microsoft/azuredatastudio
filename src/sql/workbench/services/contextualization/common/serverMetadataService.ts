/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { IDatabaseServerContextualizationService } from 'sql/workbench/services/contextualization/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

export class DatabaseServerContextualizationService extends Disposable implements IDatabaseServerContextualizationService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.contextualization.DatabaseServerContextualizationProvider>();

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
				await this.generateDatabaseServerContextualization(ownerUri);
			}
		}));
	}

	/**
	 * Register a database server contextualization service provider
	 */
	public registerProvider(providerId: string, provider: azdata.contextualization.DatabaseServerContextualizationProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`An all server metadata provider with ID "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	/**
	 * Unregister a database server contextualization service provider.
	 */
	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	/**
	 * Gets a registered database server contextualization service provider. An exception is thrown if a provider isn't registered with the specified ID.
	 * @param providerId The ID of the registered provider.
	 */
	public getProvider(providerId: string): azdata.contextualization.DatabaseServerContextualizationProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}

		throw invalidProvider(providerId);
	}

	/**
	 * Generates all database server scripts in the form of create scripts.
	 * @param ownerUri The URI of the connection to generate context scripts for.
	 */
	public generateDatabaseServerContextualization(ownerUri: string): void {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			handler.generateDatabaseServerContextualization(ownerUri);
		}
	}

	/**
	 * Gets all database server scripts in the form of create scripts.
	 * @param ownerUri The URI of the connection to get context scripts for.
	 */
	public async getDatabaseServerContextualization(ownerUri: string): Promise<azdata.contextualization.GetDatabaseServerContextualizationResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.getDatabaseServerContextualization(ownerUri);
		}
		else {
			return Promise.resolve({
				scripts: []
			});
		}
	}
}
