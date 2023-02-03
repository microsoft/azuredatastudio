/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The object types in object explorer's node context.
 */
export enum NodeType {
	Login = 'ServerLevelLogin',
	User = 'User'
}

export const PublicServerRoleName = 'public';

/**
 * User types.
 */
export enum UserType {
	/**
	 * User with a server level login.
	 */
	WithLogin = 'WithLogin',
	/**
	 * User based on a Windows user/group that has no login, but can connect to the Database Engine through membership in a Windows group.
	 */
	WithWindowsGroupLogin = 'WithWindowsGroupLogin',
	/**
	 * Contained user, authentication is done within the database.
	 */
	Contained = 'Contained',
	/**
	 * User that cannot authenticate.
	 */
	NoConnectAccess = 'NoConnectAccess'
}

/**
 * The authentication types.
 */
export enum AuthenticationType {
	Windows = 'Windows',
	Sql = 'Sql',
	AzureActiveDirectory = 'AAD'
}
