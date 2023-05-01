/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagement } from 'mssql'

/**
 * The folder types in object explorer.
 */
export const enum FolderType {
	ApplicationRoles = 'ApplicationRoles',
	DatabaseRoles = 'DatabaseRoles',
	ServerLevelLogins = 'ServerLevelLogins',
	ServerLevelServerRoles = 'ServerLevelServerRoles',
	Users = 'Users'
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

export const enum TelemetryActions {
	CreateObject = 'CreateObject',
	DeleteObject = 'DeleteObject',
	OpenNewObjectDialog = 'OpenNewObjectDialog',
	OpenPropertiesDialog = 'OpenPropertiesDialog',
	RenameObject = 'RenameObject',
	UpdateObject = 'UpdateObject'
}

export const ObjectManagementViewName = 'ObjectManagement';

export const ServerLevelSecurables: ObjectManagement.SecurableType[] = [
	ObjectManagement.SecurableType.AvailabilityGroup,
	ObjectManagement.SecurableType.Endpoint,
	ObjectManagement.SecurableType.Login,
	ObjectManagement.SecurableType.Server,
	ObjectManagement.SecurableType.ServerRole
];

export const DatabaseLevelSecurables: ObjectManagement.SecurableType[] = [
	ObjectManagement.SecurableType.AggregateFunction,
	ObjectManagement.SecurableType.ApplicationRole,
	ObjectManagement.SecurableType.Assembly,
	ObjectManagement.SecurableType.AsymmetricKey,
	ObjectManagement.SecurableType.Certificate,
	ObjectManagement.SecurableType.DatabaseRole,
	ObjectManagement.SecurableType.Database,
	ObjectManagement.SecurableType.ExternalDataSource,
	ObjectManagement.SecurableType.ExternalFileFormat,
	ObjectManagement.SecurableType.FullTextCatalog,
	ObjectManagement.SecurableType.InlineFunction,
	ObjectManagement.SecurableType.Queue,
	ObjectManagement.SecurableType.ScalarFunction,
	ObjectManagement.SecurableType.Schema,
	ObjectManagement.SecurableType.SecurityPolicy,
	ObjectManagement.SecurableType.Sequence,
	ObjectManagement.SecurableType.StoredProcedure,
	ObjectManagement.SecurableType.SymmetricKey,
	ObjectManagement.SecurableType.Synonym,
	ObjectManagement.SecurableType.Table,
	ObjectManagement.SecurableType.TableValuedFunction,
	ObjectManagement.SecurableType.UserDefinedDataType,
	ObjectManagement.SecurableType.UserDefinedTableType,
	ObjectManagement.SecurableType.User,
	ObjectManagement.SecurableType.View,
	ObjectManagement.SecurableType.XmlSchemaCollection
];
