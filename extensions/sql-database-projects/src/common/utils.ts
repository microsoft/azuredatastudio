/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as os from 'os';
import * as constants from '../common/constants';
import { promises as fs } from 'fs';

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
 * e.g. [@param innerUri: 'this\is'; @param outerUri: '\this\is\my\path'] => 'my\path'
 * @param innerUri the URI that will be cut away from the outer URI
 * @param outerUri the URI that will have any shared beginning portion removed
 */
export function trimUri(innerUri: vscode.Uri, outerUri: vscode.Uri): string {
	let innerParts = innerUri.path.split('/');
	let outerParts = outerUri.path.split('/');

	while (innerParts.length > 0 && outerParts.length > 0 && innerParts[0].toLocaleLowerCase() === outerParts[0].toLocaleLowerCase()) {
		innerParts = innerParts.slice(1);
		outerParts = outerParts.slice(1);
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
	} catch (e) {
		return false;
	}
}

/**
 * Convert camelCase input to PascalCase
 */
export function toPascalCase(input: string): string {
	return input.charAt(0).toUpperCase() + input.substr(1);
}

/**
 * get quoted path to be used in any commandline argument
 * @param filePath
 */
export function getSafePath(filePath: string): string {
	return (os.platform() === 'win32') ?
		getSafeWindowsPath(filePath) :
		getSafeNonWindowsPath(filePath);
}

/**
 * ensure that path with spaces are handles correctly
 */
export function getSafeWindowsPath(filePath: string): string {
	filePath = filePath.split('\\').join('\\\\').split('"').join('');
	return '"' + filePath + '"';
}

/**
 * ensure that path with spaces are handles correctly
 */
export function getSafeNonWindowsPath(filePath: string): string {
	filePath = filePath.split('\\').join('/').split('"').join('');
	return '"' + filePath + '"';
}

/**
 * Read SQLCMD variables from xmlDoc and return them
 * @param xmlDoc xml doc to read SQLCMD variables from. Format must be the same that sqlproj and publish profiles use
 */
export function readSqlCmdVariables(xmlDoc: any): Record<string, string> {
	let sqlCmdVariables: Record<string, string> = {};
	for (let i = 0; i < xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable).length; i++) {
		const sqlCmdVar = xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable)[i];
		const varName = sqlCmdVar.getAttribute(constants.Include);

		const varValue = sqlCmdVar.getElementsByTagName(constants.DefaultValue)[0].childNodes[0].nodeValue;
		sqlCmdVariables[varName] = varValue;
	}

	return sqlCmdVariables;
}
