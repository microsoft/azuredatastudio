/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getErrorMessage } from '../utils';
import * as localizedConstants from './localizedConstants';

export async function refreshParentNode(context: azdata.ObjectExplorerContext): Promise<void> {
	if (context) {
		try {
			const node = await azdata.objectexplorer.getNode(context.connectionProfile!.id, context.nodeInfo?.nodePath);
			const parentNode = await node?.getParent();
			await parentNode?.refresh();
		}
		catch (err) {
			await vscode.window.showErrorMessage(localizedConstants.RefreshObjectExplorerError(getErrorMessage(err)));
		}
	}
}

export async function refreshNode(context: azdata.ObjectExplorerContext): Promise<void> {
	if (context) {
		try {
			const node = await azdata.objectexplorer.getNode(context.connectionProfile!.id, context.nodeInfo?.nodePath);
			await node?.refresh();
		}
		catch (err) {
			await vscode.window.showErrorMessage(localizedConstants.RefreshObjectExplorerError(getErrorMessage(err)));
		}
	}
}

// https://docs.microsoft.com/sql/relational-databases/security/password-policy
export function isValidSQLPassword(password: string, userName: string = 'sa'): boolean {
	const containsUserName = password && userName && password.toUpperCase().includes(userName.toUpperCase());
	const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
	const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
	const hasNumbers = /\d/.test(password) ? 1 : 0;
	const hasNonAlphas = /\W/.test(password) ? 1 : 0;
	return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonAlphas >= 3);
}

/**
 * Converts number to two decimal placed string
 */
export function convertNumToTwoDecimalStringInMB(value: number): string {
	return localizedConstants.StringValueInMB(value?.toFixed(2));
}

// Escape single quotes
export function escapeSingleQuotes(value: string): string {
	return value.replace(/'/g, "\'");
}

/**
 * Backup media device type: https://docs.microsoft.com/en-us/dotnet/api/microsoft.sqlserver.management.smo.devicetype
 */
export enum MediaDeviceType {
	LogicalDevice = 0,
	Tape = 1,
	File = 2,
	Pipe = 3,
	VirtualDevice = 4,
	Url = 5
}

/**
 * Backup physical device type: https://docs.microsoft.com/en-us/dotnet/api/microsoft.sqlserver.management.smo.backupdevicetype
 */
export enum PhysicalDeviceType {
	Disk = 2,
	FloppyA = 3,
	FloppyB = 4,
	Tape = 5,
	Pipe = 6,
	CDRom = 7,
	Url = 9,
	Unknown = 100
}
