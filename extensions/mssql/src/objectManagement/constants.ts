/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
export const Windows = 'Windows';

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
export const ViewProcessorsServerPropertiesDocUrl = 'https://learn.microsoft.com/sql/database-engine/configure-windows/server-properties-processors-page';
export const ViewSecurityServerPropertiesDocUrl = 'https://learn.microsoft.com/sql/database-engine/configure-windows/server-properties-security-page';
export const ViewDatabaseSettingsPropertiesDocUrl = 'https://learn.microsoft.com/sql/database-engine/configure-windows/server-properties-database-settings-page';
export const ViewAdvancedServerPropertiesDocUrl = 'https://learn.microsoft.com/sql/database-engine/configure-windows/server-properties-advanced-page';
export const DetachDatabaseDocUrl = 'https://go.microsoft.com/fwlink/?linkid=2240322';
export const AttachDatabaseDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/attach-a-database#to-attach-a-database';
export const DatabaseGeneralPropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-general-page';
export const DatabaseOptionsPropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-options-page'
export const DropDatabaseDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/drop-database-transact-sql';
export const DatabaseScopedConfigurationPropertiesDocUrl = 'https://learn.microsoft.com/sql/t-sql/statements/alter-database-scoped-configuration-transact-sql'
export const QueryStorePropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-query-store-page'
export const DatabaseFilesPropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-files-page'
export const DatabaseFileGroupsPropertiesDocUrl = 'https://learn.microsoft.com/sql/relational-databases/databases/database-properties-filegroups-page'

export const enum TelemetryActions {
	CreateObject = 'CreateObject',
	DropObject = 'DropObject',
	OpenNewObjectDialog = 'OpenNewObjectDialog',
	OpenPropertiesDialog = 'OpenPropertiesDialog',
	RenameObject = 'RenameObject',
	UpdateObject = 'UpdateObject',
	OpenDetachDatabaseDialog = 'OpenDetachDatabaseDialog',
	OpenAttachDatabaseDialog = 'OpenAttachDatabaseDialog',
	OpenDropDatabaseDialog = 'OpenDropDatabaseDialog',
	AttachDatabase = 'AttachDatabase',
	DetachDatabase = 'DetachDatabase'
}

export const ObjectManagementViewName = 'ObjectManagement';
