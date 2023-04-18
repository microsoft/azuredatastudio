/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getErrorMessage } from '../utils';
import { AuthenticationType, NodeType, UserType } from './constants';
import { AADAuthenticationTypeDisplayText, ColumnTypeDisplayName, ContainedUserText, DatabaseTypeDisplayName, DatabaseTypeDisplayNameInTitle, LoginTypeDisplayName, LoginTypeDisplayNameInTitle, RefreshObjectExplorerError, SQLAuthenticationTypeDisplayText, TableTypeDisplayName, UserTypeDisplayName, UserTypeDisplayNameInTitle, UserWithLoginText, UserWithNoConnectAccess, UserWithWindowsGroupLoginText, ViewTypeDisplayName, WindowsAuthenticationTypeDisplayText } from './localizedConstants';

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
			await vscode.window.showErrorMessage(RefreshObjectExplorerError(getErrorMessage(err)));
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
			await vscode.window.showErrorMessage(RefreshObjectExplorerError(getErrorMessage(err)));
		}
	}
}

export function getNodeTypeDisplayName(type: string, inTitle: boolean = false): string {
	switch (type) {
		case NodeType.Login:
			return inTitle ? LoginTypeDisplayNameInTitle : LoginTypeDisplayName;
		case NodeType.User:
			return inTitle ? UserTypeDisplayNameInTitle : UserTypeDisplayName;
		case NodeType.Table:
			return TableTypeDisplayName;
		case NodeType.View:
			return ViewTypeDisplayName;
		case NodeType.Column:
			return ColumnTypeDisplayName;
		case NodeType.Database:
			return inTitle ? DatabaseTypeDisplayNameInTitle : DatabaseTypeDisplayName;
		default:
			throw new Error(`Unkown node type: ${type}`);
	}
}

export function getAuthenticationTypeDisplayName(authType: AuthenticationType | undefined): string | undefined {
	if (authType === undefined) { return undefined; }

	switch (authType) {
		case AuthenticationType.Windows:
			return WindowsAuthenticationTypeDisplayText;
		case AuthenticationType.AzureActiveDirectory:
			return AADAuthenticationTypeDisplayText;
		default:
			return SQLAuthenticationTypeDisplayText;
	}
}

export function getAuthenticationTypeByDisplayName(displayValue: string): AuthenticationType {
	switch (displayValue) {
		case WindowsAuthenticationTypeDisplayText:
			return AuthenticationType.Windows;
		case AADAuthenticationTypeDisplayText:
			return AuthenticationType.AzureActiveDirectory;
		default:
			return AuthenticationType.Sql;
	}
}

export function getUserTypeDisplayName(userType: UserType): string {
	switch (userType) {
		case UserType.WithLogin:
			return UserWithLoginText;
		case UserType.WithWindowsGroupLogin:
			return UserWithWindowsGroupLoginText;
		case UserType.Contained:
			return ContainedUserText;
		default:
			return UserWithNoConnectAccess;
	}
}

export function getUserTypeByDisplayName(userTypeDisplayName: string): UserType {
	switch (userTypeDisplayName) {
		case UserWithLoginText:
			return UserType.WithLogin;
		case UserWithWindowsGroupLoginText:
			return UserType.WithWindowsGroupLogin;
		case ContainedUserText:
			return UserType.Contained;
		default:
			return UserType.NoConnectAccess;
	}
}

// https://docs.microsoft.com/sql/relational-databases/security/password-policy
export function isValidSQLPassword(password: string, userName: string = 'sa'): boolean {
	const containsUserName = password && userName !== undefined && password.toUpperCase().includes(userName.toUpperCase());
	const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
	const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
	const hasNumbers = /\d/.test(password) ? 1 : 0;
	const hasNonAlphas = /\W/.test(password) ? 1 : 0;
	return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonAlphas >= 3);
}
