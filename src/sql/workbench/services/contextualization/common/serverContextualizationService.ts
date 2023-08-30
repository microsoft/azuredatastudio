/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IConnectionManagementService, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { IServerContextualizationService } from 'sql/workbench/services/contextualization/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

export class ServerContextualizationService extends Disposable implements IServerContextualizationService {
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.contextualization.ServerContextualizationProvider>();

	constructor(
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ICommandService private readonly _commandService: ICommandService,
		@IEditorService private readonly _editorService: IEditorService,
	) {
		super();

		this._register(this._connectionManagementService.onConnect(async (e: IConnectionParams) => {
			const copilotExt = await this._extensionService.getExtension('github.copilot');

			if (copilotExt && this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').githubCopilotContextualizationEnabled) {
				const ownerUri = e.connectionUri;
				this.generateServerContextualization(ownerUri);
			}
		}));

		this._register(this._editorService.onDidActiveEditorChange(async () => {
			const activeQueryEditorInput = this._editorService.activeEditorPane.input as QueryEditorInput;
			const uri = activeQueryEditorInput?.uri;
			if (uri) {
				await this.sendServerContextualizationToCopilot(uri, activeQueryEditorInput.serverContext);
			}
		}));
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
	 * Generates server context
	 * @param ownerUri The URI of the connection to generate context for.
	 */
	public generateServerContextualization(ownerUri: string): void {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			handler.generateServerContextualization(ownerUri);
		}
	}

	/**
	 * Gets all database context.
	 * @param ownerUri The URI of the connection to get context for.
	 */
	public async getServerContextualization(ownerUri: string): Promise<azdata.contextualization.GetServerContextualizationResult> {
		const providerName = this._connectionManagementService.getProviderIdFromUri(ownerUri);
		const handler = this.getProvider(providerName);
		if (handler) {
			return await handler.getServerContextualization(ownerUri);
		}
		else {
			return Promise.resolve({
				context: []
			});
		}
	}

	private async sendServerContextualizationToCopilot(ownerUri: string, serverContext: string[] | undefined): Promise<void> {
		if (this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').githubCopilotContextualizationEnabled) {
			var flattenedServerContext = '';

			if (serverContext) {
				// Flattening scripts from string[] to just a string
				flattenedServerContext = serverContext.filter(c => c.includes('CREATE')).join('\n');
			}
			else {
				const result = await this.getServerContextualization(ownerUri);
				// Flattening scripts from string[] to just a string
				flattenedServerContext = result.context.filter(c => c.includes('CREATE')).join('\n');
			}

			// LEWISSANCHEZ TODO: Find way to set context on untitled query editor files. Need to save first for Copilot status to say "Has Context"
			await this._commandService.executeCommand('github.copilot.provideContext', '**/*.sql', {
				value: flattenedServerContext // value is expecting a string and not a string[]
			});
		}
	}
}
