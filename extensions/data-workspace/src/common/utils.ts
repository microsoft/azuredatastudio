/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as constants from './constants';

export async function directoryExist(directoryPath: string): Promise<boolean> {
	const stats = await getFileStatus(directoryPath);
	return stats ? stats.isDirectory() : false;
}

export async function fileExist(filePath: string): Promise<boolean> {
	const stats = await getFileStatus(filePath);
	return stats ? stats.isFile() : false;
}

async function getFileStatus(path: string): Promise<fs.Stats | undefined> {
	try {
		const stats = await fs.promises.stat(path);
		return stats;
	}
	catch (e) {
		if (e.code === 'ENOENT') {
			return undefined;
		}
		else {
			throw e;
		}
	}
}

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo | undefined {
	const vscodePackageJson = require('../../package.vscode.json');
	const azdataApi = getAzdataApi();

	if (!packageJson || !azdataApi && !vscodePackageJson) {
		return undefined;
	}

	// When the extension is compiled and packaged, the content of package.json get copied here in the extension.js. This happens before the
	// package.vscode.json values replace the corresponding values in the package.json for the data-workspace-vscode extension
	// so we need to read these values directly from the package.vscode.json to get the correct extension and publisher names
	const extensionName = azdataApi ? packageJson.name : vscodePackageJson.name;

	return {
		name: extensionName,
		version: packageJson.version,
		aiKey: packageJson.aiKey
	};
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

/**
 * Shows a message with a "Learn More" button
 * @param message Info message
 * @param link Link to open when "Learn Button" is clicked
 */
export async function showInfoMessageWithLearnMoreLink(message: string, link: string): Promise<void> {
	const result = await vscode.window.showInformationMessage(message, constants.LearnMore);
	if (result === constants.LearnMore) {
		void vscode.env.openExternal(vscode.Uri.parse(link));
	}
}

/**
 * Consolidates on the error message string
 */
export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}
