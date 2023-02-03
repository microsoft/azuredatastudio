/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getErrorMessage } from '../utils';
import { AuthenticationType, NodeType, UserType } from './constants';
import { AADAuthenticationTypeDisplayText, ContainedUserText, LoginTypeDisplayName, LoginTypeDisplayNameInTitle, RefreshObjectExplorerError, SQLAuthenticationTypeDisplayText, UserTypeDisplayName, UserTypeDisplayNameInTitle, UserWithLoginText, UserWithNoConnectAccess, UserWithWindowsGroupLoginText, WindowsAuthenticationTypeDisplayText } from './localizedConstants';


export async function refreshParentNode(context: azdata.ObjectExplorerContext): Promise<void> {
	if (context) {
		try {
			const node = await azdata.objectexplorer.getNode(context.connectionProfile.id, context.nodeInfo.nodePath);
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
			const node = await azdata.objectexplorer.getNode(context.connectionProfile.id, context.nodeInfo.nodePath);
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
		default:
			throw new Error(`Unkown node type: ${type}`);
	}
}

export function getAuthenticationTypeDisplayName(authType: AuthenticationType): string {
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
