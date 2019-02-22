
'use strict';

import * as vscode from 'vscode';

export class MockExtensionContext implements vscode.ExtensionContext {
	logger: undefined;
	logPath: './';
	subscriptions: { dispose(): any; }[];
	workspaceState: vscode.Memento;
	globalState: vscode.Memento;
	extensionPath: string;
	asAbsolutePath(relativePath: string): string {
		return relativePath;
	}
	storagePath: string;

	constructor() {
		this.subscriptions = [];
	}
}

export class MockOutputChannel implements vscode.OutputChannel {
	name: string;

	append(value: string): void {
		throw new Error('Method not implemented.');
	}
	appendLine(value: string): void {
		throw new Error('Method not implemented.');
	}
	clear(): void {
		throw new Error('Method not implemented.');
	}
	show(preserveFocus?: boolean): void;
	show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
	show(column?: any, preserveFocus?: any): void {
		throw new Error('Method not implemented.');
	}
	hide(): void {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}
}
