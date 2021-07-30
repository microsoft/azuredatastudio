/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface ExtensionGlobalMemento extends vscode.Memento {
	setKeysForSync(keys: string[]): void;
}

export class MockExtensionContext implements vscode.ExtensionContext {
	extensionRuntime = 1;
	logger: undefined;
	logPath: './';
	subscriptions: { dispose(): any; }[];
	workspaceState: vscode.Memento;
	globalState: ExtensionGlobalMemento;
	extensionPath: string;
	extensionUri: vscode.Uri;
	asAbsolutePath(relativePath: string): string {
		return relativePath;
	}
	storagePath: string;
	globalStoragePath: string;
	extensionMode: vscode.ExtensionMode;

	constructor() {
		this.subscriptions = [];
	}
	extension: vscode.Extension<any>;
	storageUri: vscode.Uri;
	globalStorageUri: vscode.Uri;
	logUri: vscode.Uri;
	environmentVariableCollection: vscode.EnvironmentVariableCollection;
	secrets: vscode.SecretStorage;
}

export class MockOutputChannel implements vscode.OutputChannel {
	name: string;

	append(value: string): void {

	}
	appendLine(value: string): void {

	}
	clear(): void {

	}
	show(preserveFocus?: boolean): void;
	show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
	show(column?: any, preserveFocus?: any): void {

	}
	hide(): void {

	}
	dispose(): void {

	}
}
