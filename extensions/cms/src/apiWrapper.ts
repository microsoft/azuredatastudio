/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as mssql from '../../mssql/src/api/mssqlapis';
import * as Utils from './cmsResource/utils';
import { ICmsResourceNodeInfo } from './cmsResource/tree/baseTreeNodes';

const localize = nls.loadMessageBundle();

/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test / mock callbacks into
 * this API from our code
 *
 * @export
 * ApiWrapper
 */
export class ApiWrapper {

	private _cmsService: mssql.CmsService;
	private _registeredCmsServers: ICmsResourceNodeInfo[];

	// Data APIs
	public registerConnectionProvider(provider: azdata.ConnectionProvider): vscode.Disposable {
		return azdata.dataprotocol.registerConnectionProvider(provider);
	}

	public registerObjectExplorerProvider(provider: azdata.ObjectExplorerProvider): vscode.Disposable {
		return azdata.dataprotocol.registerObjectExplorerProvider(provider);
	}

	public registerTaskServicesProvider(provider: azdata.TaskServicesProvider): vscode.Disposable {
		return azdata.dataprotocol.registerTaskServicesProvider(provider);
	}

	public registerCapabilitiesServiceProvider(provider: azdata.CapabilitiesProvider): vscode.Disposable {
		return azdata.dataprotocol.registerCapabilitiesServiceProvider(provider);
	}

	public registerTaskHandler(taskId: string, handler: (profile: azdata.IConnectionProfile) => void): void {
		azdata.tasks.registerTask(taskId, handler);
	}

	public startBackgroundOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		azdata.tasks.startBackgroundOperation(operationInfo);
	}

	public getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return azdata.connection.getActiveConnections();
	}

	public getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		return azdata.connection.getCurrentConnection();
	}

	// VSCode APIs
	public createTerminal(name?: string, shellPath?: string, shellArgs?: string[]): vscode.Terminal {
		return vscode.window.createTerminal(name, shellPath, shellArgs);
	}

	public createTerminalWithOptions(options: vscode.TerminalOptions): vscode.Terminal {
		return vscode.window.createTerminal(options);
	}

	public executeCommand(command: string, ...rest: any[]): Thenable<any> {
		return vscode.commands.executeCommand(command, ...rest);
	}

	public getFilePathRelativeToWorkspace(uri: vscode.Uri): string {
		return vscode.workspace.asRelativePath(uri);
	}

	public getWorkspaceFolders(): vscode.WorkspaceFolder[] {
		return vscode.workspace.workspaceFolders;
	}

	public getWorkspacePathFromUri(uri: vscode.Uri): string | undefined {
		let workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
	}

	public registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): vscode.Disposable {
		return vscode.commands.registerCommand(command, callback, thisArg);
	}

	public registerDocumentOpenHandler(handler: (doc: vscode.TextDocument) => any): vscode.Disposable {
		return vscode.workspace.onDidOpenTextDocument(handler);
	}

	public registerTreeDataProvider<T>(viewId: string, treeDataProvider: vscode.TreeDataProvider<T>): vscode.Disposable {
		return vscode.window.registerTreeDataProvider(viewId, treeDataProvider);
	}

	/**
	 * Get the configuration for a extensionName
	 * @param extensionName The string name of the extension to get the configuration for
	 * @param resource The optional URI, as a URI object or a string, to use to get resource-scoped configurations
	 */
	public getConfiguration(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration('cms');
	}

	public async setConfiguration(value: any): Promise<void> {
		await vscode.workspace.getConfiguration('cms').update('servers', value, true);
	}

	/**
	 * Parse uri
	 */
	public parseUri(uri: string): vscode.Uri {
		return vscode.Uri.parse(uri);
	}

	public showOpenDialog(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined> {
		return vscode.window.showOpenDialog(options);
	}

	public showSaveDialog(options: vscode.SaveDialogOptions): Thenable<vscode.Uri> {
		return vscode.window.showSaveDialog(options);
	}

	public createDialog(title: string): azdata.window.Dialog {
		return azdata.window.createModelViewDialog(title);
	}

	public openDialog(dialog: azdata.window.Dialog): void {
		return azdata.window.openDialog(dialog);
	}

	public closeDialog(dialog: azdata.window.Dialog): void {
		return azdata.window.closeDialog(dialog);
	}

	public openTextDocument(uri: vscode.Uri): Thenable<vscode.TextDocument>;
	public openTextDocument(options: { language?: string; content?: string; }): Thenable<vscode.TextDocument>;
	public openTextDocument(uriOrOptions): Thenable<vscode.TextDocument> {
		return vscode.workspace.openTextDocument(uriOrOptions);
	}

	public showTextDocument(document: vscode.TextDocument, column?: vscode.ViewColumn, preserveFocus?: boolean, preview?: boolean): Thenable<vscode.TextEditor> {
		let options: vscode.TextDocumentShowOptions = {
			viewColumn: column,
			preserveFocus: preserveFocus,
			preview: preview
		};
		return vscode.window.showTextDocument(document, options);
	}

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	public showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showWarningMessage(message, { modal: true }, ...items);
	}

	public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showInformationMessage(message, ...items);
	}

	public createStatusBarItem(alignment?: vscode.StatusBarAlignment, priority?: number): vscode.StatusBarItem {
		return vscode.window.createStatusBarItem(alignment, priority);
	}

	public get workspaceFolders(): vscode.WorkspaceFolder[] {
		return vscode.workspace.workspaceFolders;
	}

	public createOutputChannel(name: string): vscode.OutputChannel {
		return vscode.window.createOutputChannel(name);
	}

	public registerCompletionItemProvider(selector: vscode.DocumentSelector, provider: vscode.CompletionItemProvider, ...triggerCharacters: string[]): vscode.Disposable {
		return vscode.languages.registerCompletionItemProvider(selector, provider, ...triggerCharacters);
	}

	// Connection APIs
	public openConnectionDialog(providers: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return azdata.connection.openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public async getUriForConnection(connection: azdata.connection.Connection): Promise<string> {
		let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			await azdata.connection.connect(Utils.toConnectionProfile(connection), false, false).then(async (result) => {
				ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
			});
		}
		return ownerUri;
	}

	// CMS APIs
	public async getCmsService(): Promise<mssql.CmsService> {
		if (!this._cmsService) {
			let extensionApi: mssql.MssqlExtensionApi = vscode.extensions.getExtension('Microsoft.mssql').exports;
			this._cmsService = await extensionApi.getCmsServiceProvider();
		}
		return this._cmsService;
	}

	public async getRegisteredServers(ownerUri: string, relativePath: string): Promise<mssql.ListRegisteredServersResult> {
		return this.getCmsService().then((service) => {
			return service.getRegisteredServers(ownerUri, relativePath).then((result) => {
				if (result && result.registeredServersList && result.registeredServersList) {
					return result;
				}
			});
		});
	}

	public async createCmsServer(connection: azdata.connection.Connection,
		name: string, description: string): Promise<mssql.ListRegisteredServersResult> {
		let provider = await this.getCmsService();
		connection.providerName = connection.providerName === 'MSSQL-CMS' ? 'MSSQL' : connection.providerName;
		let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			await azdata.connection.connect(Utils.toConnectionProfile(connection), false, false).then(async (result) => {
				ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
			});
		}
		return provider.createCmsServer(name, description, connection, ownerUri).then((result) => {
			if (result) {
				return result;
			}
		});
	}

	public async deleteCmsServer(cmsServer: any): Promise<void> {
		let config = this.getConfiguration();
		if (config && config.servers) {
			let newServers = config.servers.filter((cachedServer) => {
				return cachedServer.name !== cmsServer;
			});
			await this.setConfiguration(newServers);
			this._registeredCmsServers = this._registeredCmsServers.filter((cachedServer) => {
				return cachedServer.name !== cmsServer;
			});
		}
	}

	public cacheRegisteredCmsServer(name: string, description: string, ownerUri: string, connection: azdata.connection.Connection): void {
		if (!this._registeredCmsServers) {
			this._registeredCmsServers = [];
		}
		let cmsServerNode: ICmsResourceNodeInfo = {
			name: name,
			description: description,
			connection: connection,
			ownerUri: ownerUri
		};
		this._registeredCmsServers.push(cmsServerNode);
	}

	public async addRegisteredServer(relativePath: string, ownerUri: string,
		parentServerName?: string): Promise<boolean> {
		let provider = await this.getCmsService();
		// Initial profile to disallow SQL Login without
		// changing provider.
		let initialProfile: azdata.IConnectionProfile = {
			connectionName: undefined,
			serverName: undefined,
			databaseName: undefined,
			userName: undefined,
			password: undefined,
			authenticationType: undefined,
			savePassword: undefined,
			groupFullName: undefined,
			groupId: undefined,
			providerName: undefined,
			saveProfile: undefined,
			id: undefined,
			options: {
				authTypeChanged: true
			}
		};
		return this.openConnectionDialog(['MSSQL-CMS'], initialProfile, { saveConnection: false }).then(async (connection) => {
			if (connection && connection.options) {
				if (connection.options.server === parentServerName) {
					// error out for same server registration
					let errorText = localize('cms.errors.sameServerUnderCms', 'You cannot add a shared registered server with the same name as the Configuration Server');
					this.showErrorMessage(errorText);
					return false;
				} else {
					let registeredServerName = connection.options.registeredServerName === '' ? connection.options.server : connection.options.registeredServerName;
					let result = await provider.addRegisteredServer(ownerUri, relativePath, registeredServerName, connection.options.registeredServerDescription, connection);
					return result;
				}

			}
		});
	}

	public async removeRegisteredServer(registeredServerName: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		return provider.removeRegisteredServer(ownerUri, relativePath, registeredServerName).then((result) => {
			return result;
		});
	}

	public async addServerGroup(groupName: string, groupDescription: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		return provider.addServerGroup(ownerUri, relativePath, groupName, groupDescription).then((result) => {
			return result;
		});
	}

	public async removeServerGroup(groupName: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		return provider.removeServerGroup(ownerUri, relativePath, groupName).then((result) => {
			return result;
		});
	}

	// Getters

	public get registeredCmsServers(): ICmsResourceNodeInfo[] {
		return this._registeredCmsServers;
	}

	public get connection(): Thenable<azdata.connection.Connection> {
		return this.openConnectionDialog(['MSSQL-CMS'], undefined, { saveConnection: false }).then((connection) => {
			if (connection) {
				// remove group ID from connection if a user chose connection
				// from the recent connections list
				connection.options['groupId'] = null;
				connection.providerName = 'MSSQL';
				return connection;
			}
		});
	}
}