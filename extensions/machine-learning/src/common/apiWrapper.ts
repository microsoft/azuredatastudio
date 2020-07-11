/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azurecore from '../../../azurecore/src/azurecore';

/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test / mock callbacks into
 * this API from our code
 */
export class ApiWrapper {
	public createOutputChannel(name: string): vscode.OutputChannel {
		return vscode.window.createOutputChannel(name);
	}

	public createTerminalWithOptions(options: vscode.TerminalOptions): vscode.Terminal {
		return vscode.window.createTerminal(options);
	}

	public getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		return azdata.connection.getCurrentConnection();
	}

	public getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return azdata.connection.getCredentials(connectionId);
	}

	public registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): vscode.Disposable {
		return vscode.commands.registerCommand(command, callback, thisArg);
	}

	public executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined> {
		return vscode.commands.executeCommand(command, ...rest);
	}
	public registerTaskHandler(taskId: string, handler: (profile: azdata.IConnectionProfile) => void): void {
		azdata.tasks.registerTask(taskId, handler);
	}

	public getUriForConnection(connectionId: string): Thenable<string> {
		return azdata.connection.getUriForConnection(connectionId);
	}

	public getProvider<T extends azdata.DataProvider>(providerId: string, providerType: azdata.DataProviderType): T {
		return azdata.dataprotocol.getProvider<T>(providerId, providerType);
	}

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	public showInfoMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showInformationMessage(message, ...items);
	}

	public showOpenDialog(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined> {
		return vscode.window.showOpenDialog(options);
	}

	public startBackgroundOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		azdata.tasks.startBackgroundOperation(operationInfo);
	}

	public openExternal(target: vscode.Uri): Thenable<boolean> {
		return vscode.env.openExternal(target);
	}

	public getExtension(extensionId: string): vscode.Extension<any> | undefined {
		return vscode.extensions.getExtension(extensionId);
	}

	public getConfiguration(section?: string, resource?: vscode.Uri | null): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration(section, resource);
	}

	public createTab(title: string): azdata.window.DialogTab {
		return azdata.window.createTab(title);
	}

	public createModelViewDialog(title: string, dialogName?: string, isWide?: boolean): azdata.window.Dialog {
		return azdata.window.createModelViewDialog(title, dialogName, isWide);
	}

	public createWizard(title: string): azdata.window.Wizard {
		return azdata.window.createWizard(title);
	}

	public createWizardPage(title: string): azdata.window.WizardPage {
		return azdata.window.createWizardPage(title);
	}

	public openDialog(dialog: azdata.window.Dialog): void {
		return azdata.window.openDialog(dialog);
	}

	public getAllAccounts(): Thenable<azdata.Account[]> {
		return azdata.accounts.getAllAccounts();
	}

	public getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{ [key: string]: any }> {
		return azdata.accounts.getSecurityToken(account, resource);
	}

	public showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken): Thenable<T | undefined> {
		return vscode.window.showQuickPick(items, options, token);
	}

	public listDatabases(connectionId: string): Thenable<string[]> {
		return azdata.connection.listDatabases(connectionId);
	}

	public getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return azdata.connection.getServerInfo(connectionId);
	}

	public openTextDocument(options?: { language?: string; content?: string; }): Thenable<vscode.TextDocument> {
		return vscode.workspace.openTextDocument(options);
	}

	public connect(fileUri: string, connectionId: string): Thenable<void> {
		return azdata.queryeditor.connect(fileUri, connectionId);
	}

	public runQuery(fileUri: string, options?: Map<string, string>, runCurrentQuery?: boolean): void {
		azdata.queryeditor.runQuery(fileUri, options, runCurrentQuery);
	}

	public showTextDocument(uri: vscode.Uri, options?: vscode.TextDocumentShowOptions): Thenable<vscode.TextEditor> {
		return vscode.window.showTextDocument(uri, options);
	}

	public createButton(label: string, position?: azdata.window.DialogButtonPosition): azdata.window.Button {
		return azdata.window.createButton(label, position);
	}

	public registerWidget(widgetId: string, handler: (view: azdata.ModelView) => void): void {
		azdata.ui.registerModelViewProvider(widgetId, handler);
	}

	private azurecoreApi: azurecore.IExtension | undefined;

	public async getAzurecoreApi(): Promise<azurecore.IExtension> {
		if (!this.azurecoreApi) {
			this.azurecoreApi = await this.getExtension(azurecore.extension.name)?.activate();
			if (!this.azurecoreApi) {
				throw new Error('Unable to retrieve azurecore API');
			}
		}
		return this.azurecoreApi;
	}
}
