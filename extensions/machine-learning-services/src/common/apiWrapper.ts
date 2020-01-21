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
}
