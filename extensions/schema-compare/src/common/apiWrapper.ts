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
	public openConnectionDialog(providers?: string[],
		initialConnectionProfile?: azdata.IConnectionProfile,
		connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return azdata.connection.openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): vscode.Disposable {
		return vscode.commands.registerCommand(command, callback, thisArg);
	}

	public getUriForConnection(connectionId: string): Thenable<string> {
		return azdata.connection.getUriForConnection(connectionId);
	}

	public getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]> {
		return azdata.connection.getConnections(activeConnectionsOnly);
	}

	public connect(connectionProfile: azdata.IConnectionProfile, saveConnection?: boolean, showDashboard?: boolean): Thenable<azdata.ConnectionResult> {
		return azdata.connection.connect(connectionProfile, saveConnection, showDashboard);
	}

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	public showWarningMessage(message: string, options?: vscode.MessageOptions, ...items: string[]): Thenable<string | undefined> {
		if (options) {
			return vscode.window.showWarningMessage(message, options, ...items);
		}
		else {
			return vscode.window.showWarningMessage(message, ...items);
		}
	}
}
