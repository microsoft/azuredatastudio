/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Abstract of platform dependencies
 */
export interface IPlatformService {
	platform(): string;
	copyFile(source: string, target: string): void;
	fileExists(file: string): boolean;
	openFile(filePath: string): void;
	showErrorMessage(message: string): void;
}

export class PlatformService implements IPlatformService {
	platform(): string {
		return process.platform;
	}

	copyFile(source: string, target: string): void {
		fs.copyFileSync(source, target);
	}

	fileExists(file: string): boolean {
		return fs.existsSync(file);
	}

	openFile(filePath: string): void {
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
	}

	showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}
}