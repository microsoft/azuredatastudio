/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The folder types in object explorer.
 */
export const enum FolderType {
	ApplicationRoles = 'ApplicationRoles',
	DatabaseRoles = 'DatabaseRoles',
	ServerLevelLogins = 'ServerLevelLogins',
	ServerLevelServerRoles = 'ServerLevelServerRoles',
	Users = 'Users',
	Databases = 'Databases'
}

export const PublicServerRoleName = 'public';

export const CreateUserDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/create-user-transact-sql';
export const AlterUserDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/alter-user-transact-sql';
export const CreateLoginDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/create-login-transact-sql';
export const AlterLoginDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/alter-login-transact-sql';
export const CreateServerRoleDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/create-server-role-transact-sql';
export const AlterServerRoleDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/alter-server-role-transact-sql';
export const CreateApplicationRoleDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/create-application-role-transact-sql';
export const AlterApplicationRoleDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/alter-application-role-transact-sql';
export const CreateDatabaseRoleDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/create-role-transact-sql';
export const AlterDatabaseRoleDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/alter-role-transact-sql';
export const CreateDatabaseDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/create-database-transact-sql';
export const ViewGeneralServerPropertiesDocUrl = 'https://learn.microsoft.com/sql/t-sql/functions/serverproperty-transact-sql';
export const ViewMemoryServerPropertiesDocUrl = 'https://learn.microsoft.com/sql/database-engine/configure-windows/server-properties-memory-page';
export const DetachDatabaseDocUrl = 'https://go.microsoft.com/fwlink/?linkid=2240322';
export const DatabaseGeneralPropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-general-page';
export const DatabaseOptionsPropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-options-page'
export const DeleteDatabaseDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/drop-database-transact-sql';

export const enum TelemetryActions {
	CreateObject = 'CreateObject',
	DeleteObject = 'DeleteObject',
	OpenNewObjectDialog = 'OpenNewObjectDialog',
	OpenPropertiesDialog = 'OpenPropertiesDialog',
	RenameObject = 'RenameObject',
	UpdateObject = 'UpdateObject',
	OpenDetachDatabaseDialog = 'OpenDetachDatabaseDialog',
	OpenDeleteDatabaseDialog = 'OpenDeleteDatabaseDialog'
}

export const ObjectManagementViewName = 'ObjectManagement';
