/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { IServerContextualizationService } from 'sql/workbench/services/contextualization/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

export class ServerContextualizationService extends Disposable implements IServerContextualizationService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.contextualization.ServerContextualizationProvider>();

	constructor(
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ICommandService private readonly _commandService: ICommandService,
		@ILogService private readonly _logService: ILogService
	) {
		super();
	}

	/**
	 * Register a server contextualization service provider
	 */
	public registerProvider(providerId: string, provider: azdata.contextualization.ServerContextualizationProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`A server contextualization provider with ID "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	/**
	 * Unregister a server contextualization service provider.
	 */
	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	/**
	 * Gets a registered server contextualization service provider. An exception is thrown if a provider isn't registered with the specified ID.
	 * @param providerId The ID of the registered provider.
	 */
	public getProvider(providerId: string): azdata.contextualization.ServerContextualizationProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			this._logService.info(`Found server contextualization provider for ${providerId}`);
			return provider;
		}

		this._logService.info(`No server contextualization provider found for ${providerId}`);
		throw invalidProvider(providerId);
	}

	/**
	 * Contextualizes the provided URI for GitHub Copilot.
	 * @param uri The URI to contextualize for Copilot.
	 * @returns Copilot will have the URI contextualized when the promise completes.
	 */
	public async contextualizeUriForCopilot(uri: string): Promise<void> {
		// Don't need to take any actions if contextualization is not enabled and can return
		const isContextualizationNeeded = await this.isContextualizationNeeded();
		if (!isContextualizationNeeded) {
			this._logService.info('Contextualization is not needed because the GitHub Copilot extension is not installed and/or contextualization is disabled.');
			return;
		}

		const getServerContextualizationResult = await this.getServerContextualization(uri);
		if (getServerContextualizationResult.context) {
			this._logService.info(`Server contextualization was retrieved for the URI (${uri}) connection, so sending that to Copilot for context.`);

			await this.sendServerContextualizationToCopilot(getServerContextualizationResult.context);
		}
		else {
			this._logService.warn(`Server contextualization was not generated for the URI (${uri}) connection, so no context will be sent to Copilot.`);
		}
	}

	/**
	 * Gets all database context.
	 * @param ownerUri The URI of the connection to get context for.
	 */
	private async getServerContextualization(ownerUri: string): Promise<azdata.contextualization.GetServerContextualizationResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			this._logService.info(`Getting server contextualization for ${ownerUri}`);

			return await handler.getServerContextualization(ownerUri);
		}
		else {
			this._logService.info(`No server contextualization provider found for ${ownerUri}`);

			return Promise.resolve({
				context: undefined
			});
		}
	}

	/**
	 * Sends the provided context over to copilot, so that it can be used to generate improved suggestions.
	 * @param serverContext The context to be sent over to Copilot
	 */
	private async sendServerContextualizationToCopilot(serverContext: string | undefined): Promise<void> {
		if (serverContext) {
			this._logService.info('Sending server contextualization to Copilot');

			// LEWISSANCHEZ TODO: Find way to set context on untitled query editor files. Need to save first for Copilot status to say "Has Context"
			await this._commandService.executeCommand('github.copilot.provideContext', '**/*.sql', {
				value: serverContext
			});
		}
	}

	/**
	 * Checks if contextualization is needed. This is based on whether the Copilot extension is installed and the GitHub Copilot
	 * contextualization setting is enabled.
	 * @returns A promise that resolves to true if contextualization is needed, false otherwise.
	 */
	private async isContextualizationNeeded(): Promise<boolean> {
		const copilotExt = await this._extensionService.getExtension('github.copilot');
		if (!copilotExt) {
			this._logService.info('GitHub Copilot extension is not installed, so contextualization is not needed.');
		}

		const isContextualizationEnabled = this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').githubCopilotContextualizationEnabled
		if (!isContextualizationEnabled) {
			this._logService.info('GitHub Copilot contextualization is disabled, so contextualization is not needed.');
		}

		return (copilotExt && isContextualizationEnabled);
	}
}
