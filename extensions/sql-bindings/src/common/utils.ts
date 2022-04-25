/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as vscodeMssql from 'vscode-mssql';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as glob from 'fast-glob';
import * as cp from 'child_process';

export interface ValidationResult {
	errorMessage: string;
	validated: boolean
}

/**
 * Consolidates on the error message string
 */
export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

export async function getAzureFunctionService(): Promise<vscodeMssql.IAzureFunctionsService> {
	if (getAzdataApi()) {
		// this isn't supported in ADS
		throw new Error('Azure Functions service is not supported in Azure Data Studio');
	} else {
		const api = await getVscodeMssqlApi();
		return api.azureFunctions;
	}
}

export async function getVscodeMssqlApi(): Promise<vscodeMssql.IExtension> {
	const ext = vscode.extensions.getExtension(vscodeMssql.extension.name) as vscode.Extension<vscodeMssql.IExtension>;
	return ext.activate();
}

export interface IPackageInfo {
	name: string;
	fullName: string;
	version: string;
	aiKey: string;
}

// Try to load the azdata API - but gracefully handle the failure in case we're running
// in a context where the API doesn't exist (such as VS Code)
let azdataApi: typeof azdataType | undefined = undefined;
try {
	azdataApi = require('azdata');
	if (!azdataApi?.version) {
		// webpacking makes the require return an empty object instead of throwing an error so make sure we clear the var
		azdataApi = undefined;
	}
} catch {
	// no-op
}

/**
 * Gets the azdata API if it's available in the context this extension is running in.
 * @returns The azdata API if it's available
 */
export function getAzdataApi(): typeof azdataType | undefined {
	return azdataApi;
}

export async function createFolderIfNotExist(folderPath: string): Promise<void> {
	try {
		await fse.mkdir(folderPath);
	} catch {
		// Ignore if failed
	}
}

export async function executeCommand(command: string, cwd?: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		cp.exec(command, { maxBuffer: 500 * 1024, cwd: cwd }, (error: Error | null, stdout: string, stderr: string) => {
			if (error) {
				reject(error);
				return;
			}
			if (stderr && stderr.length > 0) {
				reject(new Error(stderr));
				return;
			}
			resolve(stdout);
		});
	});
}

/**
 * Gets all the projects of the specified extension in the folder
 * @param folder
 * @param projectExtension project extension to filter on
 * @returns array of project uris
 */
export async function getAllProjectsInFolder(folder: vscode.Uri, projectExtension: string): Promise<vscode.Uri[]> {
	// path needs to use forward slashes for glob to work
	const escapedPath = glob.escapePath(folder.fsPath.replace(/\\/g, '/'));

	// filter for projects with the specified project extension
	const projFilter = path.posix.join(escapedPath, '**', `*${projectExtension}`);

	// glob will return an array of file paths with forward slashes, so they need to be converted back if on windows
	return (await glob(projFilter)).map(p => vscode.Uri.file(path.resolve(p)));
}

/**
 * Gets the package info for the extension based on where the extension is installed
 * @returns the package info object
 */
export function getPackageInfo(): IPackageInfo {
	const packageJson = require('../../package.json');
	return {
		name: packageJson.name,
		fullName: `${packageJson.publisher}.${packageJson.name}`,
		version: packageJson.version,
		aiKey: packageJson.aiKey
	};
}
