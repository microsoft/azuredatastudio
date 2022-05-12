/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as vscodeMssql from 'vscode-mssql';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'fast-glob';
import * as cp from 'child_process';
import * as constants from '../common/constants';

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

export class TimeoutError extends Error { }

/**
 * Consolidates on the error message string
 * @param error The error object to get the message from
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
			reject(new TimeoutError(errorMessage));
		}, ms);
	});
}

/**
 * Gets a unique file name
 * Increment the file name by adding 1 to function name if the file already exists
 * Undefined if the filename suffix count becomes greater than 1024
 * @param fileName base filename to use
 * @param folderPath selected project folder path
 * @returns a promise with the unique file name, or undefined
 */
export async function getUniqueFileName(fileName: string, folderPath?: string): Promise<string | undefined> {
	if (!folderPath) {
		// user is creating a brand new azure function project
		return undefined;
	}

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
 * Removes all special characters from object name
 * @param objectName can include brackets/periods and user entered special characters
 * @returns the object name without any special characters
 */
export function santizeObjectName(objectName: string): string {
	return objectName.replace(/[^a-zA-Z0-9 ]/g, '');
}

/**
 * Check to see if the input from user entered is valid
 * @param input from user input
 * @returns returns error if the input is empty or has special characters, undefined if the input is valid
 */
export function validateFunctionName(input: string): string | undefined {
	const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
	if (!input) {
		return constants.nameMustNotBeEmpty;
	} else if (specialChars.test(input)) {
		return constants.hasSpecialCharacters;
	}
	return undefined;
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
export function getErrorType(error: any): string | undefined {
	if (error instanceof TimeoutError) {
		return 'TimeoutError';
	} else {
		return 'UnknownError';
	}
}

/**
 * Query to be used for the SimpleExecuteRequest to get the list of schemas and tables from the selected databse
 * @param database database is the one user selected 
 * @returns string query to be used for the SimpleExecuteRequest 
 */
export function listTablesQuery(database: string): string {
	return `select concat(table_schema, '.', table_name) from ${database}.INFORMATION_SCHEMA.TABLES where TABLE_TYPE = 'BASE TABLE'`;
}
