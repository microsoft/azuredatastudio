/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as fs from 'fs';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

/**
 * Abstract of platform dependencies
 */
export interface IPlatformService {
	platform(): string;
	copyFile(source: string, target: string): void;
	fileExists(file: string): boolean;
	openFile(filePath: string): void;
	showErrorMessage(message: string): void;
	isNotebookNameUsed(title: string): boolean;
}

export class PlatformService implements IPlatformService {
	platform(): string {
		return process.platform;
	}

	copyFile(source: string, target: string): void {
		// tslint:disable-next-line:no-sync
		fs.copyFileSync(source, target);
	}

	fileExists(file: string): boolean {
		// tslint:disable-next-line:no-sync
		return fs.existsSync(file);
	}

	openFile(filePath: string): void {
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
	}

	showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}

	isNotebookNameUsed(title: string): boolean {
		return (azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1);
	}
}
