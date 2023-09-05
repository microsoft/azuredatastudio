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
			this._logService.info(`Server contextualization was previously generated for the URI (${uri}) connection, so sending that to Copilot for context.`);

			await this.sendServerContextualizationToCopilot(getServerContextualizationResult.context, uri);
		}
		else {
			this._logService.info(`Server contextualization was not previously generated for the URI (${uri}) connection. Generating now...`);

			const generateServerContextualizationResult = await this.generateServerContextualization(uri);
			if (generateServerContextualizationResult.context) {
				this._logService.info(`Server contextualization was generated for the URI (${uri}) connection, so sending that to Copilot.`);

				await this.sendServerContextualizationToCopilot(generateServerContextualizationResult.context, uri);
			}
			else {
				this._logService.warn(`Server contextualization was not generated for the URI (${uri}) connection, so no context will be sent to Copilot.`);
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
			this._logService.info(`Generating server contextualization for ${ownerUri}`);

			return await handler.generateServerContextualization(ownerUri);
		}
		else {
			this._logService.info(`No server contextualization provider found for ${ownerUri}`);

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
	 * @param uri The URI of the editor that the context should be associated with.
	 */
	private async sendServerContextualizationToCopilot(serverContext: string | undefined, uri: string): Promise<void> {
		if (serverContext) {
			this._logService.info('Sending server contextualization to Copilot');

			// If the URI starts with `file:///` or `untitled:` then we need to remove that
			// prefix to match what the Copilot fork expects
			if (uri.startsWith('file:///')) {
				uri = uri.replace('file:///', '');
			}
			if (uri.startsWith('untitled:')) {
				uri = uri.replace('untitled:', '');
			}

			// We need to "compress" context to fit within a fixed token budget
			let compressedContext = serverContext;
			try {
				compressedContext = this.compressContext(serverContext);
			} catch (e) {
				this._logService.warn(`Failed to compress context: ${e}`);
			}

			await this._commandService.executeCommand('github.copilot.provideContext', uri, {
				value: compressedContext
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

	/**
	 * Compresses the given table context string by iteratively reducing the
	 * amount of information in the string until it fits within a fixed
	 * token budget (approximately).
	 * @param context The context string (database schema) to compress.
	 * @param tokenBudget The maximum number of tokens allowed in the compressed context string.
	 * @returns The compressed context string.
	 */
	private compressContext(context: string, tokenBudget: number = 1000): string {
		if (!context) {
			throw new Error('Context parameter cannot be null or undefined.');
		}

		// We're given a string w/ database context (tables/cols/type info/etc.)
		// Let's clean up some irrelevant info
		const cleanCtx = context.replace(/SET .*?(ON|OFF)/g, '');

		// Now let's clean up some whitespace (multiple newlines -> single newline)
		const reducedWhitespaceCtx = cleanCtx.replace(/\n{2,}/g, '\n');

		// Let's estimate tokens (instead of _actually_ doing tokenization)
		// For now, we'll use this heuristic:
		const tokenCount = (s: string) => Math.round((s ?? '').length * 0.35) + 25;

		// We want this string to be as large as possible, but we're limited by
		// a fixed token budget; we'll apply various strategies to compress the
		// context string while we are over budget. If reducedWhitespaceCtx is already
		// under budget, we'll just return it as-is.
		if (tokenCount(reducedWhitespaceCtx) <= tokenBudget) {
			return reducedWhitespaceCtx;
		}

		// Okay, we're over budget - let's try to compress the context string
		// We'll start by grabbing each CREATE TABLE statement
		const tables = reducedWhitespaceCtx.match(/CREATE TABLE.*?(\n|$)/g);
		const columnAblations = tables?.map(table => {
			try {
				return this.produceTableAblations(table, tokenCount);
			} catch (e) {
				// On failure, just return the table as-is
				return [table, table, table, table, table];
			}
		});

		// Okay, now to render the final (compressed) context
		// We have 5 ablations for each table, so we'll start by trying
		// to take the best ablation for each table (5) and work our
		// way down to (4) -> (3) -> (2) -> and (1)
		const maxAblations = columnAblations[0]?.length ?? 0;
		for (let i = maxAblations - 1; i >= 0; i--) {
			// Get the best ablation for each table
			const bestAblations = columnAblations.map(ablations => ablations[i]);

			// Now we'll try to join all the best ablations together
			const compressedContext = bestAblations.join('\n');

			// Check if we're under budget
			if (tokenCount(compressedContext) <= tokenBudget) {
				// Log what level of compression we were able to achieve
				this._logService.info(`Compressed context to level:=${i + 1}`);
				// We're under budget, so we can return
				return compressedContext;
			}
		}

		// Okay, we're still over budget so we'll try and just return
		// as many table names as we can (with a comment on how many we elided)
		const justTableNames = [];
		const smallestAblations = columnAblations.map(tableAblations => tableAblations[0]);
		// Take into account the elision template text
		const elisionTemplateTextTokenCount = tokenCount('/* 0000 more tables not shown ... */');
		const reducedTokenBudget = tokenBudget - elisionTemplateTextTokenCount;
		while (tokenCount(justTableNames.join('\n')) < reducedTokenBudget) {
			const tableName = smallestAblations?.shift();
			if (tableName) {
				justTableNames.push(tableName);
			}
			else {
				break;
			}
		}

		// Log what level of compression we were able to achieve
		this._logService.info(`Compressed context to level:=0`);
		this._logService.info(`Elided ${smallestAblations.length} tables from context`);

		// Now we'll add the elision template text
		justTableNames.push(`/* ${smallestAblations.length} more tables not shown ... */`);
		return justTableNames.join('\n').trim();
	}

	/**
	 * Produces several ablations of the table strings
	 * (1) Just the `CREATE TABLE <name>`
	 * (2) The table name + first few cols (no types)
	 *     `CREATE TABLE <name> (Col1, Col2, /* x more columns ... )`
	 * (3) The table + all cols (no types)
	 *     `CREATE TABLE <name> (Col1, Col2, ..., ColN)`
	 * (4) The table + all cols (w/ types)
	 *     `CREATE TABLE <name> (Col1 <type>, Col2 <type>, ..., ColN <type>)`
	 * (5) The statement as-is
	 * @param table The table string to produce ablations for
	 * @param tokenCount A function that estimates the number of tokens in a string
	 * @returns An array of ablations for the table string
	 */
	private produceTableAblations(table: string, tokenCount: (string) => number): string[] {
		// Get (1)
		const tableName = table.match(/CREATE TABLE\s*(.*?)\s*\(/)?.[1];

		// Get the rest of the create
		let restOfCreate = table.replace(/CREATE TABLE.*?\(/, '');
		// Remove last ')' and any trailing whitespace
		restOfCreate = restOfCreate.replace(/\)\s*$/, '');

		// Iteravitely get the cols (w/ and w/o types)
		const justCols = [];
		const colsWithTypes = [];
		while (restOfCreate.length > 0) {
			// Get the next column
			const col = restOfCreate.match(/(.*?)\s*(,\[|$)/)?.[1];
			if (col) {
				// Remove the column from the rest of the create
				restOfCreate = restOfCreate.replace(col, '');
				// Remove the trailing comma
				restOfCreate = restOfCreate.replace(/^\s*,/, '');
				// Remove any leading whitespace
				restOfCreate = restOfCreate.trim();

				// Add the column to the list of columns
				const colName = col.split(' ')[0];
				justCols.push(colName);

				// Add the column w/ type to the list of columns
				// (trying to ignore NOT NULL / other constraints)
				const colWithType = (colName + ' ' + col.split(' ')?.[1]) ?? col;
				colsWithTypes.push(colWithType);
			}
			else {
				// No more columns
				break;
			}
		}

		// For (2) we'll take the first 3 cols and add a comment for the rest
		const justFirstFewCols = justCols.slice(0, 3);
		const justFirstFewColsWithComment = [...justFirstFewCols];
		if (justCols.length > 3) {
			justFirstFewColsWithComment.push(`/* ${justCols.length - 3} more cols not shown ... */`);
		}

		// Now return all the ablations
		const ablations = [
			`CREATE TABLE ${tableName}`,
			`CREATE TABLE ${tableName} (${justFirstFewColsWithComment.join(', ')})`,
			`CREATE TABLE ${tableName} (${justCols.join(', ')})`,
			`CREATE TABLE ${tableName} (${colsWithTypes.join(', ')})`,
			table.replace(/,\[/g, ', [')  // Add spaces after commas
		];

		// Get each ablation (trimmed) w/ it's token count
		const ablationsWithTokenCounts = ablations.map(ablation => {
			return {
				ablation: ablation.trim(),
				tokenCount: tokenCount(ablation.trim())
			};
		});

		// If there's ever an ablation that's less than the previous ablation,
		// we'll use that one instead (these should be strictly increasing in token count)
		let bestAblation = ablationsWithTokenCounts[0];
		for (let i = 1; i < ablationsWithTokenCounts.length; i++) {
			if (ablationsWithTokenCounts[i].tokenCount < bestAblation.tokenCount) {
				bestAblation = ablationsWithTokenCounts[i];
				ablationsWithTokenCounts[i - 1] = bestAblation;
			}
		}

		// Return all the ablations w/ their token counts
		return ablationsWithTokenCounts.map(ablation => ablation.ablation);
	}
}
