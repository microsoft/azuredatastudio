/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as vscodeMssql from 'vscode-mssql';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'fast-glob';
import * as cp from 'child_process';

export interface ValidationResult {
	errorMessage: string;
	validated: boolean
}

export interface IPackageInfo {
	name: string;
	fullName: string;
	version: string;
	aiKey: string;
}

/**
 * Consolidates on the error message string
 */
export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

export async function getVscodeMssqlApi(): Promise<vscodeMssql.IExtension> {
	const ext = vscode.extensions.getExtension(vscodeMssql.extension.name) as vscode.Extension<vscodeMssql.IExtension>;
	return ext.activate();
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
 * Format a string. Behaves like C#'s string.Format() function.
 */
export function formatString(str: string, ...args: any[]): string {
	// This is based on code originally from https://github.com/Microsoft/vscode/blob/master/src/vs/nls.js
	// License: https://github.com/Microsoft/vscode/blob/master/LICENSE.txt
	let result: string;
	if (args.length === 0) {
		result = str;
	} else {
		result = str.replace(/\{(\d+)\}/g, (match, rest) => {
			let index = rest[0];
			return typeof args[index] !== 'undefined' ? args[index] : match;
		});
	}
	return result;
}

/**
 * Generates a quoted full name for the object
 * @param schema of the object
 * @param objectName object chosen by the user
 * @returns the quoted and escaped full name of the specified schema and object
 */
export function generateQuotedFullName(schema: string, objectName: string): string {
	return `[${escapeClosingBrackets(schema)}].[${escapeClosingBrackets(objectName)}]`;
}

/**
 * Returns a promise that will reject after the specified timeout
 * @param errorMessage error message to be returned in the rejection
 * @param ms timeout in milliseconds. Default is 10 seconds
 * @returns a promise that rejects after the specified timeout
 */
export function timeoutPromise(errorMessage: string, ms: number = 10000): Promise<string> {
	return new Promise((_, reject) => {
		setTimeout(() => {
			reject(new Error(errorMessage));
		}, ms);
	});
}

/**
 * Gets a unique file name
 * Increment the file name by adding 1 to function name if the file already exists
 * Undefined if the filename suffix count becomes greater than 1024
 * @param folderPath selected project folder path
 * @param fileName base filename to use
 * @returns a promise with the unique file name, or undefined
 */
export async function getUniqueFileName(folderPath: string, fileName: string): Promise<string | undefined> {
	let count: number = 0;
	const maxCount: number = 1024;
	let uniqueFileName = fileName;

	while (count < maxCount) {
		if (!fs.existsSync(path.join(folderPath, uniqueFileName + '.cs'))) {
			return uniqueFileName;
		}
		count += 1;
		uniqueFileName = fileName + count.toString();
	}
	return undefined;
}

export function escapeClosingBrackets(str: string): string {
	return str.replace(']', ']]');
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
