/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as os from 'os';
import * as constants from './constants';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Consolidates on the error message string
 */
export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

/**
 * removes any leading portion shared between the two URIs from outerUri.
 * e.g. [@param innerUri: 'this\is'; @param outerUri: '\this\is\my\path'] => 'my\path' OR
 * e.g. [@param innerUri: 'this\was'; @param outerUri: '\this\is\my\path'] => '..\is\my\path'
 * @param innerUri the URI that will be cut away from the outer URI
 * @param outerUri the URI that will have any shared beginning portion removed
 */
export function trimUri(innerUri: vscode.Uri, outerUri: vscode.Uri): string {
	let innerParts = innerUri.path.split('/');
	let outerParts = outerUri.path.split('/');

	if (path.isAbsolute(outerUri.path)
		&& innerParts.length > 0 && outerParts.length > 0
		&& innerParts[0].toLowerCase() !== outerParts[0].toLowerCase()) {
		throw new Error(constants.ousiderFolderPath);
	}

	while (innerParts.length > 0 && outerParts.length > 0 && innerParts[0].toLocaleLowerCase() === outerParts[0].toLocaleLowerCase()) {
		innerParts = innerParts.slice(1);
		outerParts = outerParts.slice(1);
	}

	while (innerParts.length > 1) {
		outerParts.unshift(constants.RelativeOuterPath);
		innerParts = innerParts.slice(1);
	}

	return outerParts.join('/');
}

/**
 * Trims any character contained in @param chars from both the beginning and end of @param input
 */
export function trimChars(input: string, chars: string): string {
	let output = input;

	let i = 0;
	while (chars.includes(output[i])) { i++; }
	output = output.substr(i);

	i = 0;
	while (chars.includes(output[output.length - i - 1])) { i++; }
	output = output.substring(0, output.length - i);

	return output;
}

/**
 * Checks if the folder or file exists @param path path of the folder/file
*/
export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * get quoted path to be used in any commandline argument
 * @param filePath
 */
export function getQuotedPath(filePath: string): string {
	return (os.platform() === 'win32') ?
		getQuotedWindowsPath(filePath) :
		getQuotedNonWindowsPath(filePath);
}

/**
 * ensure that path with spaces are handles correctly (return quoted path)
 */
function getQuotedWindowsPath(filePath: string): string {
	filePath = filePath.split('\\').join('\\\\').split('"').join('');
	return '"' + filePath + '"';
}

/**
 * ensure that path with spaces are handles correctly (return quoted path)
 */
function getQuotedNonWindowsPath(filePath: string): string {
	filePath = filePath.split('\\').join('/').split('"').join('');
	return '"' + filePath + '"';
}

/**
 * Get safe relative path for Windows and non-Windows Platform
 * This is needed to read sqlproj entried created on SSDT and opened in MAC
 * '/' in tree is recognized all platforms but "\\" only by windows
 */
export function getPlatformSafeFileEntryPath(filePath: string): string {
	const parts = filePath.split('\\');
	return parts.join('/');
}

/**
 * Standardizes slashes to be "\\" for consistency between platforms and compatibility with SSDT
 */
export function convertSlashesForSqlProj(filePath: string): string {
	const parts = filePath.split('/');
	return parts.join('\\');
}

/**
 * Read SQLCMD variables from xmlDoc and return them
 * @param xmlDoc xml doc to read SQLCMD variables from. Format must be the same that sqlproj and publish profiles use
 */
export function readSqlCmdVariables(xmlDoc: any): Record<string, string> {
	let sqlCmdVariables: Record<string, string> = {};
	for (let i = 0; i < xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable)?.length; i++) {
		const sqlCmdVar = xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable)[i];
		const varName = sqlCmdVar.getAttribute(constants.Include);

		if (sqlCmdVar.getElementsByTagName(constants.DefaultValue)[0] !== undefined) {
			// project file path
			sqlCmdVariables[varName] = sqlCmdVar.getElementsByTagName(constants.DefaultValue)[0].childNodes[0].nodeValue;
		}
		else {
			// profile path
			sqlCmdVariables[varName] = sqlCmdVar.getElementsByTagName(constants.Value)[0].childNodes[0].nodeValue;
		}
	}

	return sqlCmdVariables;
}
