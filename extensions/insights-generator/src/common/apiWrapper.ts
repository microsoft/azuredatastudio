/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test/mock callbacks into
 * this API from our code
 */

export class ApiWrapper {

	public createOutputChannel(name: string): vscode.OutputChannel {
		return vscode.window.createOutputChannel(name);
	}

	public getExtension(extensionId: string): vscode.Extension<any> | undefined {
		return vscode.extensions.getExtension(extensionId);
	}

	public getUriForConnection(connectionId: string): Thenable<string> {
		return azdata.connection.getUriForConnection(connectionId);
	}

	public getProvider<T extends azdata.DataProvider>(providerId: string, providerType: azdata.DataProviderType): T {
		return azdata.dataprotocol.getProvider<T>(providerId, providerType);
	}

	public getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		return azdata.connection.getCurrentConnection();
	}

	public openConnectionDialog(providers?: string[]): Thenable<azdata.connection.Connection> {
		return azdata.connection.openConnectionDialog(providers);
	}

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	public createWizard(title: string): azdata.window.Wizard {
		return azdata.window.createWizard(title);
	}

	public createWizardPage(title: string): azdata.window.WizardPage {
		return azdata.window.createWizardPage(title);
	}

	public createButton(lable: string) {
		return azdata.window.createButton(lable);
	}

	public showOpenDialog(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined> {
		return vscode.window.showOpenDialog(options);
	}

	public getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return azdata.connection.getActiveConnections();
	}

	public listDatabases(connectionId: string): Thenable<string[]> {
		return azdata.connection.listDatabases(connectionId);
	}

	public openExternal(target: vscode.Uri): Thenable<boolean> {
		return vscode.env.openExternal(target);
	}

	public getConfiguration(section?: string, resource?: vscode.Uri | null): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration(section, resource);
	}

	public registerTask(task: string, callback: azdata.tasks.ITaskHandler) {
		azdata.tasks.registerTask(task, callback);
	}

	public getCredentials(connectionId: string) {
		return azdata.connection.getCredentials(connectionId);
	}

	public getConnectionString(connectionId: string, includePassword: boolean) {
		return azdata.connection.getConnectionString(connectionId, includePassword);
	}


}
