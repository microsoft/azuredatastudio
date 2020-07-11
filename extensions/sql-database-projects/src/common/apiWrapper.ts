/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test / mock callbacks into
 * this API from our code
 */
export class ApiWrapper {
	//#region azdata.accounts

	public getAllAccounts(): Thenable<azdata.Account[]> {
		return azdata.accounts.getAllAccounts();
	}

	public getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{ [key: string]: any }> {
		return azdata.accounts.getSecurityToken(account, resource);
	}

	//#endregion

	//#region azdata.connection

	public getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		return azdata.connection.getCurrentConnection();
	}

	public openConnectionDialog(providers?: string[],
		initialConnectionProfile?: azdata.IConnectionProfile,
		connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return azdata.connection.openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return azdata.connection.getCredentials(connectionId);
	}

	public connectionConnect(connectionProfile: azdata.IConnectionProfile, saveConnection?: boolean, showDashboard?: boolean): Thenable<azdata.ConnectionResult> {
		return azdata.connection.connect(connectionProfile, saveConnection, showDashboard);
	}

	public getUriForConnection(connectionId: string): Thenable<string> {
		return azdata.connection.getUriForConnection(connectionId);
	}

	public listDatabases(connectionId: string): Thenable<string[]> {
		return azdata.connection.listDatabases(connectionId);
	}

	//#endregion

	//#region azdata.dataprotocol

	public getProvider<T extends azdata.DataProvider>(providerId: string, providerType: azdata.DataProviderType): T {
		return azdata.dataprotocol.getProvider<T>(providerId, providerType);
	}

	//#endregion

	//#region azdata.queryeditor

	public connect(fileUri: string, connectionId: string): Thenable<void> {
		return azdata.queryeditor.connect(fileUri, connectionId);
	}

	public runQuery(fileUri: string, options?: Map<string, string>, runCurrentQuery?: boolean): void {
		azdata.queryeditor.runQuery(fileUri, options, runCurrentQuery);
	}

	//#endregion

	//#region azdata.tasks

	public registerTaskHandler(taskId: string, handler: (profile: azdata.IConnectionProfile) => void): void {
		azdata.tasks.registerTask(taskId, handler);
	}

	public startBackgroundOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		azdata.tasks.startBackgroundOperation(operationInfo);
	}

	//#endregion

	//#region azdata.ui

	public registerWidget(widgetId: string, handler: (view: azdata.ModelView) => void): void {
		azdata.ui.registerModelViewProvider(widgetId, handler);
	}

	//#endregion

	//#region azdata.window

	public closeDialog(dialog: azdata.window.Dialog) {
		azdata.window.closeDialog(dialog);
	}

	//#endregion

	//#region vscode.commands

	public registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): vscode.Disposable {
		return vscode.commands.registerCommand(command, callback, thisArg);
	}

	public executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined> {
		return vscode.commands.executeCommand(command, ...rest);
	}

	//#endregion

	//#region vscode.env

	public openExternal(target: vscode.Uri): Thenable<boolean> {
		return vscode.env.openExternal(target);
	}

	//#endregion

	//#region vscode.extensions

	public getExtension(extensionId: string): vscode.Extension<any> | undefined {
		return vscode.extensions.getExtension(extensionId);
	}

	//#endregion

	//#region vscode.window

	public createOutputChannel(name: string): vscode.OutputChannel {
		return vscode.window.createOutputChannel(name);
	}

	public createTerminalWithOptions(options: vscode.TerminalOptions): vscode.Terminal {
		return vscode.window.createTerminal(options);
	}

	public registerTreeDataProvider<T>(viewId: string, treeDataProvider: vscode.TreeDataProvider<T>): vscode.Disposable {
		return vscode.window.registerTreeDataProvider(viewId, treeDataProvider);
	}

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showInformationMessage(message, ...items);
	}

	public showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showWarningMessage(message, ...items);
	}

	public showWarningMessageOptions(message: string, options: vscode.MessageOptions, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showWarningMessage(message, options, ...items);
	}

	public showOpenDialog(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined> {
		return vscode.window.showOpenDialog(options);
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

	public showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken): Thenable<T | undefined> {
		return vscode.window.showQuickPick(items, options, token);
	}

	public showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string | undefined> {
		return vscode.window.showInputBox(options, token);
	}

	public showSaveDialog(options: vscode.SaveDialogOptions): Thenable<vscode.Uri | undefined> {
		return vscode.window.showSaveDialog(options);
	}

	public showTextDocument(uri: vscode.Uri, options?: vscode.TextDocumentShowOptions): Thenable<vscode.TextEditor> {
		return vscode.window.showTextDocument(uri, options);
	}

	public createButton(label: string, position?: azdata.window.DialogButtonPosition): azdata.window.Button {
		return azdata.window.createButton(label, position);
	}

	public createTreeView<T>(viewId: string, options: vscode.TreeViewOptions<T>): vscode.TreeView<T> {
		return vscode.window.createTreeView(viewId, options);
	}

	//#endregion

	//#region vscode.workspace

	public getConfiguration(section?: string, resource?: vscode.Uri | null): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration(section, resource);
	}

	public workspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
		return vscode.workspace.workspaceFolders;
	}

	public openTextDocument(options?: { language?: string; content?: string; }): Thenable<vscode.TextDocument> {
		return vscode.workspace.openTextDocument(options);
	}

	//#endregion
}
