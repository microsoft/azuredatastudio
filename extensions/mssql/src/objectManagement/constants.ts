/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The folder types in object explorer.
 */
export const enum FolderType {
	ServerLevelLogins = 'ServerLevelLogins',
	Users = 'Users'
}

export const PublicServerRoleName = 'public';

export const CreateUserDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql';
export const AlterUserDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-user-transact-sql';
export const CreateLoginDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/create-login-transact-sql';
export const AlterLoginDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-login-transact-sql';
export const CreateDatabaseDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/create-database-transact-sql';
export const DropDatabaseDocUrl = 'https://learn.microsoft.com/en-us/sql/t-sql/statements/drop-database-transact-sql';

export const enum TelemetryActions {
	CreateObject = 'CreateObject',
	DeleteObject = 'DeleteObject',
	OpenNewObjectDialog = 'OpenNewObjectDialog',
	OpenPropertiesDialog = 'OpenPropertiesDialog',
	RenameObject = 'RenameObject',
	UpdateObject = 'UpdateObject',
	CreateDatabaseDialog = 'CreateDatabaseDialog',
	DeleteDatabaseDialog = 'DeleteDatabaseDialog',
}

export const ObjectManagementViewName = 'ObjectManagement';
