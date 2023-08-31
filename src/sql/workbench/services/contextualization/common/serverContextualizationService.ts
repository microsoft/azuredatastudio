/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { IServerContextualizationService } from 'sql/workbench/services/contextualization/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

export class ServerContextualizationService extends Disposable implements IServerContextualizationService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.contextualization.ServerContextualizationProvider>();

	constructor(
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ICommandService private readonly _commandService: ICommandService
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
			return provider;
		}

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
			return;
		}

		const getServerContextualizationResult = await this.getServerContextualization(uri);
		if (getServerContextualizationResult.context) {
			await this.sendServerContextualizationToCopilot(getServerContextualizationResult.context);
		}
		else {
			const generateServerContextualizationResult = await this.generateServerContextualization(uri);
			if (generateServerContextualizationResult.context) {
				await this.sendServerContextualizationToCopilot(generateServerContextualizationResult.context);
			}
		}
	}

	/**
	 * Generates server context
	 * @param ownerUri The URI of the connection to generate context for.
	 */
	private async generateServerContextualization(ownerUri: string): Promise<azdata.contextualization.GenerateServerContextualizationResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.generateServerContextualization(ownerUri);
		}
		else {
			return Promise.resolve({
				context: undefined
			});
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
			return await handler.getServerContextualization(ownerUri);
		}
		else {
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
		const isContextualizationEnabled = this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').githubCopilotContextualizationEnabled

		return (copilotExt && isContextualizationEnabled);
	}
}
