/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as cp from 'child_process';

/**
 * Abstract of platform dependencies
 */
export interface IPlatformService {
	platform(): string;
	storagePath(): string;
	copyFile(source: string, target: string): Promise<void>;
	fileExists(file: string): Promise<boolean>;
	openFile(filePath: string): void;
	showErrorMessage(message: string): void;
	isNotebookNameUsed(title: string): boolean;
	makeDirectory(path: string): Promise<void>;
	readTextFile(filePath: string): Promise<string>;
	runCommand(command: string, options?: CommandOptions): Promise<string>;
}

export interface CommandOptions {
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
}

export class PlatformService implements IPlatformService {
	constructor(private _storagePath: string = '') {
	}

	storagePath(): string {
		return this._storagePath;
	}

	platform(): string {
		return process.platform;
	}

	copyFile(source: string, target: string): Promise<void> {
		return fs.promises.copyFile(source, target);
	}

	fileExists(file: string): Promise<boolean> {
		return fs.promises.access(file).then(() => {
			return true;
		}).catch(error => {
			if (error && error.code === 'ENOENT') {
				return false;
			}
			throw error;
		});
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

	makeDirectory(path: string): Promise<void> {
		return fs.promises.mkdir(path);
	}

	readTextFile(filePath: string): Promise<string> {
		return fs.promises.readFile(filePath, 'utf8');
	}

	runCommand(command: string, options?: CommandOptions): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const env = Object.assign({}, process.env, options && options.additionalEnvironmentVariables);
			cp.exec(command, {
				cwd: options && options.workingDirectory,
				env: env
			}, (error, stdout, stderror) => {
				if (error) {
					reject(error);
				} else {
					resolve(stdout);
				}
			});
		});
	}
}
