/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getErrorMessage } from '../utils';
import { ObjectManagement } from 'mssql';
import * as localizedConstants from './localizedConstants';

export function deepClone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result: any = Array.isArray(obj) ? [] : {};
	Object.keys(<any>obj).forEach((key: string) => {
		if ((<any>obj)[key] && typeof (<any>obj)[key] === 'object') {
			result[key] = deepClone((<any>obj)[key]);
		} else {
			result[key] = (<any>obj)[key];
		}
	});
	return result;
}

export async function refreshParentNode(context: azdata.ObjectExplorerContext): Promise<void> {
	if (context) {
		try {
			const node = await azdata.objectexplorer.getNode(context.connectionProfile!.id, context.nodeInfo!.nodePath);
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
			const node = await azdata.objectexplorer.getNode(context.connectionProfile!.id, context.nodeInfo!.nodePath);
			await node?.refresh();
		}
		catch (err) {
			await vscode.window.showErrorMessage(localizedConstants.RefreshObjectExplorerError(getErrorMessage(err)));
		}
	}
}

export function getNodeTypeDisplayName(type: string, inTitle: boolean = false): string {
	switch (type) {
		case ObjectManagement.NodeType.ApplicationRole:
			return inTitle ? localizedConstants.ApplicationRoleTypeDisplayNameInTitle : localizedConstants.ApplicationRoleTypeDisplayName;
		case ObjectManagement.NodeType.DatabaseRole:
			return inTitle ? localizedConstants.DatabaseRoleTypeDisplayNameInTitle : localizedConstants.DatabaseRoleTypeDisplayName;
		case ObjectManagement.NodeType.ServerLevelLogin:
			return inTitle ? localizedConstants.LoginTypeDisplayNameInTitle : localizedConstants.LoginTypeDisplayName;
		case ObjectManagement.NodeType.ServerLevelServerRole:
			return inTitle ? localizedConstants.ServerRoleTypeDisplayNameInTitle : localizedConstants.ServerRoleTypeDisplayName;
		case ObjectManagement.NodeType.User:
			return inTitle ? localizedConstants.UserTypeDisplayNameInTitle : localizedConstants.UserTypeDisplayName;
		case ObjectManagement.NodeType.Table:
			return localizedConstants.TableTypeDisplayName;
		case ObjectManagement.NodeType.View:
			return localizedConstants.ViewTypeDisplayName;
		case ObjectManagement.NodeType.Column:
			return localizedConstants.ColumnTypeDisplayName;
		case ObjectManagement.NodeType.Database:
			return localizedConstants.DatabaseTypeDisplayName;
		default:
			throw new Error(`Unknown node type: ${type}`);
	}
}

export function getAuthenticationTypeDisplayName(authType: ObjectManagement.AuthenticationType | undefined): string | undefined {
	if (authType === undefined) { return undefined; }

	switch (authType) {
		case ObjectManagement.AuthenticationType.Windows:
			return localizedConstants.WindowsAuthenticationTypeDisplayText;
		case ObjectManagement.AuthenticationType.AzureActiveDirectory:
			return localizedConstants.AADAuthenticationTypeDisplayText;
		default:
			return localizedConstants.SQLAuthenticationTypeDisplayText;
	}
}

export function getAuthenticationTypeByDisplayName(displayValue: string): ObjectManagement.AuthenticationType {
	switch (displayValue) {
		case localizedConstants.WindowsAuthenticationTypeDisplayText:
			return ObjectManagement.AuthenticationType.Windows;
		case localizedConstants.AADAuthenticationTypeDisplayText:
			return ObjectManagement.AuthenticationType.AzureActiveDirectory;
		default:
			return ObjectManagement.AuthenticationType.Sql;
	}
}

export function getUserTypeDisplayName(userType: ObjectManagement.UserType): string {
	switch (userType) {
		case ObjectManagement.UserType.WithLogin:
			return localizedConstants.UserWithLoginText;
		case ObjectManagement.UserType.WithWindowsGroupLogin:
			return localizedConstants.UserWithWindowsGroupLoginText;
		case ObjectManagement.UserType.Contained:
			return localizedConstants.ContainedUserText;
		default:
			return localizedConstants.UserWithNoConnectAccess;
	}
}

export function getUserTypeByDisplayName(userTypeDisplayName: string): ObjectManagement.UserType {
	switch (userTypeDisplayName) {
		case localizedConstants.UserWithLoginText:
			return ObjectManagement.UserType.WithLogin;
		case localizedConstants.UserWithWindowsGroupLoginText:
			return ObjectManagement.UserType.WithWindowsGroupLogin;
		case localizedConstants.ContainedUserText:
			return ObjectManagement.UserType.Contained;
		default:
			return ObjectManagement.UserType.NoConnectAccess;
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
