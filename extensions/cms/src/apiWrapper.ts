/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as mssql from '../../mssql/src/api/mssqlapis';
import * as constants from './constants';
import * as Utils from './cmsResource/utils';
import { CmsResourceNodeInfo } from './cmsResource/tree/baseTreeNodes';

/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test / mock callbacks into
 * this API from our code
 *
 * @export
 * @class ApiWrapper
 */
export class ApiWrapper {

	private _cmsService: mssql.CmsService;
	private _registeredCmsServers: CmsResourceNodeInfo[];

	// Data APIs
	public registerConnectionProvider(provider: sqlops.ConnectionProvider): vscode.Disposable {
		return sqlops.dataprotocol.registerConnectionProvider(provider);
	}

	public registerObjectExplorerProvider(provider: sqlops.ObjectExplorerProvider): vscode.Disposable {
		return sqlops.dataprotocol.registerObjectExplorerProvider(provider);
	}

	public registerTaskServicesProvider(provider: sqlops.TaskServicesProvider): vscode.Disposable {
		return sqlops.dataprotocol.registerTaskServicesProvider(provider);
	}

	public registerCapabilitiesServiceProvider(provider: sqlops.CapabilitiesProvider): vscode.Disposable {
		return sqlops.dataprotocol.registerCapabilitiesServiceProvider(provider);
	}

	public registerModelViewProvider(widgetId: string, handler: (modelView: sqlops.ModelView) => void): void {
		return sqlops.ui.registerModelViewProvider(widgetId, handler);
	}

	public registerTaskHandler(taskId: string, handler: (profile: sqlops.IConnectionProfile) => void): void {
		sqlops.tasks.registerTask(taskId, handler);
	}

	public startBackgroundOperation(operationInfo: sqlops.BackgroundOperationInfo): void {
		sqlops.tasks.startBackgroundOperation(operationInfo);
	}

	public getActiveConnections(): Thenable<sqlops.connection.Connection[]> {
		return sqlops.connection.getActiveConnections();
	}

	public getCurrentConnection(): Thenable<sqlops.connection.Connection> {
		return sqlops.connection.getCurrentConnection();
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

	public setCommandContext(key: string, value: any): Thenable<any> {
		return vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, key, value);
	}

	/**
	 * Get the configuration for a extensionName
	 * @param extensionName The string name of the extension to get the configuration for
	 * @param resource The optional URI, as a URI object or a string, to use to get resource-scoped configurations
	 */
	public getConfiguration(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration().get('cms');
	}

	public async setConfiguration(value: any) {
		await vscode.workspace.getConfiguration().update('cms.cmsServers', value, true);
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
		return vscode.window.showWarningMessage(message, ...items);
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

	public createWizardPage(title: string): sqlops.window.modelviewdialog.WizardPage {
		return sqlops.window.modelviewdialog.createWizardPage(title);
	}

	public registerCompletionItemProvider(selector: vscode.DocumentSelector, provider: vscode.CompletionItemProvider, ...triggerCharacters: string[]): vscode.Disposable {
		return vscode.languages.registerCompletionItemProvider(selector, provider, ...triggerCharacters);
	}

	public createTab(title: string): sqlops.window.modelviewdialog.DialogTab {
		return sqlops.window.modelviewdialog.createTab(title);
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

	// Connection APIs
	public openConnectionDialog(providers: string[], initialConnectionProfile?: sqlops.IConnectionProfile, connectionCompletionOptions?: sqlops.IConnectionCompletionOptions): Thenable<sqlops.connection.Connection> {
		return sqlops.connection.openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions, true);
	}

	public async createCmsServer(connection: sqlops.connection.Connection, name: string, description: string) {
		let provider = await this.getCmsService();
		let ownerUri = await sqlops.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			await sqlops.connection.connect(Utils.toConnectionProfile(connection), false, false).then( async (result) => {
				ownerUri = await sqlops.connection.getUriForConnection(result.connectionId);
			});
		}
		return provider.createCmsServer(name, description, connection, ownerUri).then((result) => {
			if (result) {
				return result;
			}
		});
	}

	public addRegisteredCmsServers(name: string, description: string, ownerUri: string, connection: sqlops.connection.Connection) {
		if (!this._registeredCmsServers) {
			this._registeredCmsServers = [];
		}
		let cmsServerNode: CmsResourceNodeInfo = {
			name: name,
			description: description,
			ownerUri: ownerUri,
			connection: connection
		};
		this._registeredCmsServers.push(cmsServerNode);
	}

	public get registeredCmsServers(): CmsResourceNodeInfo[] {
		return this._registeredCmsServers;
	}

	public get connection(): Thenable<sqlops.connection.Connection> {
		return this.openConnectionDialog(['MSSQL']).then((connection) => {
			if (connection) {
				return connection;
			}
		});
	}
}
