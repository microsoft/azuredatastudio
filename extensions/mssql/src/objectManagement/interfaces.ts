/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Documents:
// Server Login: https://learn.microsoft.com/en-us/sql/t-sql/statements/create-login-transact-sql?view=sql-server-ver15&preserve-view=true
// Server Role: https://learn.microsoft.com/en-us/sql/t-sql/statements/create-server-role-transact-sql?view=sql-server-ver15
// Database Role: https://learn.microsoft.com/en-us/sql/t-sql/statements/create-role-transact-sql?view=sql-server-ver15
// Database User: https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver15

// Notes: SSMS, object management operations are not transactional

export interface SqlObject {
	name: string;
	path: string;
}

export interface Permission {
	name: string;
	grant: boolean;
	withGrant: boolean;
	deny: boolean;
}

export interface SecurablePermissions {
	securable: SqlObject;
	permissions: Permission[];
}

export interface ExtendedProperty {
	name: string;
	value: string;
}

export interface ServerRole extends SqlObject {
	owner: string | undefined;
	securablePermissions: SecurablePermissions[];
	members: SqlObject[];
	memberships: SqlObject[];
	isFixedRole: boolean;
}

export interface ServerLogin extends SqlObject {
	type: LoginType;
	password: string | undefined;
	oldPassword: string | undefined;
	enforcePasswordPolicy: boolean | undefined;
	enforcePasswordExpiration: boolean | undefined;
	defaultDatabase: string;
	defaultLanguage: string;
	serverRoles: string[];
	userMapping: ServerLoginDatabaseUserMapping[];
	isGroup: boolean;
	isEnabled: boolean;
	connectPermission: boolean;
	isLockedOut: boolean;
}

export enum LoginType {
	Windows = 'Windows',
	Sql = 'Sql',
	AzureActiveDirectory = 'AAD'
}

export interface ServerLoginDatabaseUserMapping {
	database: string;
	user: string;
	defaultSchema: string;
	databaseRoles: string[];
}

export interface DatabaseRole extends SqlObject {
	owner: string | undefined;
	password: string | undefined;
	ownedSchemas: string[];
	securablePermissions: SecurablePermissions[] | undefined;
	extendedProperties: ExtendedProperty[] | undefined;
	isFixedRole: boolean;
}

export interface DatabaseUser extends SqlObject {
	type: DatabaseUserType;
	isAAD: boolean | undefined;
	password: string | undefined;
	defaultSchema: string | undefined;
	ownedSchemas: string[] | undefined;
	loginName: string | undefined;
	isEnabled: boolean;
	extendedProperties: ExtendedProperty[] | undefined;
	securablePermissions: SecurablePermissions[] | undefined;
}

export enum DatabaseUserType {
	UserWithLogin = 'UserWithLogin',
	UserWithoutLogin = 'UserWithoutLogin'
}

export enum ObjectType {

}
