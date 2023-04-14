/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The object types in object explorer's node context.
 */
export enum NodeType {
	Column = 'Column',
	Database = 'Database',
	Login = 'ServerLevelLogin',
	Table = 'Table',
	User = 'User',
	View = 'View'
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

export const CreateUserDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql';
export const AlterUserDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-user-transact-sql';
export const CreateLoginDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/create-login-transact-sql';
export const AlterLoginDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-login-transact-sql';

export enum TelemetryActions {
	CreateObject = 'CreateObject',
	DeleteObject = 'DeleteObject',
	OpenNewObjectDialog = 'OpenNewObjectDialog',
	OpenPropertiesDialog = 'OpenPropertiesDialog',
	RenameObject = 'RenameObject',
	UpdateObject = 'UpdateObject',
	CreateDatabaseDialog = 'CreateDatabaseDialog',
	DeleteDatabaseDialog = 'DeleteDatabaseDialog',
}

export enum TelemetryViews {
	ObjectManagement = 'ObjectManagement',
	Admin = 'Admin'
}
