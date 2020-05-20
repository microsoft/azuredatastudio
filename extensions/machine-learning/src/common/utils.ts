/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as constants from './constants';
import { promisify } from 'util';
import { ApiWrapper } from './apiWrapper';

export async function execCommandOnTempFile<T>(content: string, command: (filePath: string) => Promise<T>): Promise<T> {
	let tempFilePath: string = '';
	try {
		tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
		await fs.promises.writeFile(tempFilePath, content);
		let result = await command(tempFilePath);
		return result;
	}
	finally {
		await deleteFile(tempFilePath);
	}
}

/**
 * Deletes a file
 * @param filePath file path
 */
export async function deleteFile(filePath: string) {
	if (filePath) {
		await fs.promises.unlink(filePath);
	}
}

export async function readFileInHex(filePath: string): Promise<string> {
	let buffer = await fs.promises.readFile(filePath);
	return `0X${buffer.toString('hex')}`;
}

export async function exists(path: string): Promise<boolean> {
	return promisify(fs.exists)(path);
}

export async function isDirectory(path: string): Promise<boolean> {
	try {
		const stat = await fs.promises.lstat(path);
		return stat.isDirectory();
	} catch {
		return false;
	}
}

export async function createFolder(dirPath: string): Promise<void> {
	let folderExists = await exists(dirPath);
	if (!folderExists) {
		await fs.promises.mkdir(dirPath);
	}
}

export function getPythonInstallationLocation(rootFolder: string) {
	return path.join(rootFolder, 'python');
}

export function getPythonExePath(rootFolder: string): string {
	return path.join(
		getPythonInstallationLocation(rootFolder),
		constants.pythonBundleVersion,
		process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
}

export function getPackageFilePath(rootFolder: string, packageName: string): string {
	return path.join(
		rootFolder,
		constants.rLPackagedFolderName,
		packageName);
}

export function getRPackagesFolderPath(rootFolder: string): string {
	return path.join(
		rootFolder,
		constants.rLPackagedFolderName);
}

/**
 * Compares two version strings to see which is greater.
 * @param first First version string to compare.
 * @param second Second version string to compare.
 * @returns 1 if the first version is greater, -1 if it's less, and 0 otherwise.
 */
export function comparePackageVersions(first: string, second: string): number {
	let firstVersion = first.split('.').map(numStr => Number.parseInt(numStr));
	let secondVersion = second.split('.').map(numStr => Number.parseInt(numStr));

	// If versions have different lengths, then append zeroes to the shorter one
	if (firstVersion.length > secondVersion.length) {
		let diff = firstVersion.length - secondVersion.length;
		secondVersion = secondVersion.concat(new Array(diff).fill(0));
	} else if (secondVersion.length > firstVersion.length) {
		let diff = secondVersion.length - firstVersion.length;
		firstVersion = firstVersion.concat(new Array(diff).fill(0));
	}

	for (let i = 0; i < firstVersion.length; ++i) {
		if (firstVersion[i] > secondVersion[i]) {
			return 1;
		} else if (firstVersion[i] < secondVersion[i]) {
			return -1;
		}
	}
	return 0;
}

export function sortPackageVersions(versions: string[], ascending: boolean = true) {
	return versions.sort((first, second) => {
		let compareResult = comparePackageVersions(first, second);
		if (ascending) {
			return compareResult;
		} else {
			return compareResult * -1;
		}
	});
}

export function isWindows(): boolean {
	return process.platform === 'win32';
}

/**
 * Escapes all single-quotes (') by prefixing them with another single quote ('')
 * ' => ''
 * @param value The string to escape
 */
export function doubleEscapeSingleQuotes(value: string | undefined): string {
	return value ? value.replace(/'/g, '\'\'') : '';
}

/**
 * Escapes all single-bracket ([]) by replacing them with another bracket quote ([[]])
 * ' => ''
 * @param value The string to escape
 */
export function doubleEscapeSingleBrackets(value: string | undefined): string {
	return value ? value.replace(/\[/g, '[[').replace(/\]/g, ']]') : '';
}

/**
 * Installs dependencies for the extension
 */
export async function executeTasks<T>(apiWrapper: ApiWrapper, taskName: string, dependencies: PromiseLike<T>[], parallel: boolean): Promise<T[]> {
	return new Promise<T[]>((resolve, reject) => {
		let msgTaskName = taskName;
		apiWrapper.startBackgroundOperation({
			displayName: msgTaskName,
			description: msgTaskName,
			isCancelable: false,
			operation: async op => {
				try {
					let result: T[] = [];
					// Install required packages
					//
					if (parallel) {
						result = await Promise.all(dependencies);
					} else {
						for (let index = 0; index < dependencies.length; index++) {
							result.push(await dependencies[index]);
						}
					}
					op.updateStatus(azdata.TaskStatus.Succeeded);
					resolve(result);
				} catch (error) {
					let errorMsg = constants.taskFailedError(taskName, error ? error.message : '');
					op.updateStatus(azdata.TaskStatus.Failed, errorMsg);
					reject(errorMsg);
				}
			}
		});
	});
}

export async function promptConfirm(message: string, apiWrapper: ApiWrapper): Promise<boolean> {
	let choices: { [id: string]: boolean } = {};
	choices[constants.msgYes] = true;
	choices[constants.msgNo] = false;

	let options = {
		placeHolder: message
	};

	let result = await apiWrapper.showQuickPick(Object.keys(choices).map(c => {
		return {
			label: c
		};
	}), options);
	if (result === undefined) {
		throw Error('invalid selection');
	}

	return choices[result.label] || false;
}

export function makeLinuxPath(filePath: string): string {
	const parts = filePath.split('\\');
	return parts.join('/');
}

/**
 *
 * @param currentDb Wraps the given script with database switch scripts
 * @param databaseName
 * @param script
 */
export function getScriptWithDBChange(currentDb: string, databaseName: string, script: string): string {
	if (!currentDb) {
		currentDb = 'master';
	}
	let escapedDbName = doubleEscapeSingleBrackets(databaseName);
	let escapedCurrentDbName = doubleEscapeSingleBrackets(currentDb);
	return `
	USE [${escapedDbName}]
	${script}
	USE [${escapedCurrentDbName}]
	`;
}

/**
 * Returns full name of model registration table
 * @param config config
 */
export function getRegisteredModelsThreePartsName(db: string, table: string, schema: string) {
	const dbName = doubleEscapeSingleBrackets(db);
	const schemaName = doubleEscapeSingleBrackets(schema);
	const tableName = doubleEscapeSingleBrackets(table);
	return `[${dbName}].[${schemaName}].[${tableName}]`;
}

/**
 * Returns full name of model registration table
 * @param config config object
 */
export function getRegisteredModelsTwoPartsName(table: string, schema: string) {
	const schemaName = doubleEscapeSingleBrackets(schema);
	const tableName = doubleEscapeSingleBrackets(table);
	return `[${schemaName}].[${tableName}]`;
}

/**
 * Write a file using a hex string
 * @param content file content
 */
export async function writeFileFromHex(content: string): Promise<string> {
	content = content.startsWith('0x') || content.startsWith('0X') ? content.substr(2) : content;
	const tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
	await fs.promises.writeFile(tempFilePath, Buffer.from(content, 'hex'));
	return tempFilePath;
}

/**
 *
 * @param filePath Returns file name
 */
export function getFileName(filePath: string) {
	if (filePath) {
		return filePath.replace(/^.*[\\\/]/, '');
	} else {
		return '';
	}
}

export function getDefaultPythonLocation(): string {

	return path.join(getUserHome() || '', 'azuredatastudio-python',
		constants.adsPythonBundleVersion,
		getPythonExeName());
}

export function getPythonExeName(): string {
	return process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3';
}

export function getUserHome(): string | undefined {
	return process.env.HOME || process.env.USERPROFILE;
}
