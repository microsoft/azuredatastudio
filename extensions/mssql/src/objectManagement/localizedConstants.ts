/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ObjectManagement } from 'mssql';
import { ObjectTypeInfo } from './ui/findObjectDialog';
const localize = nls.loadMessageBundle();

// Object Types
export const LoginTypeDisplayName: string = localize('objectManagement.LoginTypeDisplayName', "login");
export const UserTypeDisplayName: string = localize('objectManagement.UserDisplayName', "user");
export const LoginTypeDisplayNameInTitle: string = localize('objectManagement.LoginTypeDisplayNameInTitle', "Login");
export const UserTypeDisplayNameInTitle: string = localize('objectManagement.UserTypeDisplayNameInTitle', "User");
export const TableTypeDisplayName: string = localize('objectManagement.TableDisplayName', "table");
export const ViewTypeDisplayName: string = localize('objectManagement.ViewDisplayName', "view");
export const ColumnTypeDisplayName: string = localize('objectManagement.ColumnDisplayName', "column");
export const DatabaseTypeDisplayName: string = localize('objectManagement.DatabaseDisplayName', "database");
export const ServerRoleTypeDisplayName: string = localize('objectManagement.ServerRoleTypeDisplayName', "server role");
export const ServerRoleTypeDisplayNameInTitle: string = localize('objectManagement.ServerRoleTypeDisplayNameInTitle', "Server Role");
export const ApplicationRoleTypeDisplayName: string = localize('objectManagement.ApplicationRoleTypeDisplayName', "application role");
export const ApplicationRoleTypeDisplayNameInTitle: string = localize('objectManagement.ApplicationRoleTypeDisplayNameInTitle', "Application Role");
export const DatabaseRoleTypeDisplayName: string = localize('objectManagement.DatabaseRoleTypeDisplayName', "database role");
export const DatabaseRoleTypeDisplayNameInTitle: string = localize('objectManagement.DatabaseRoleTypeDisplayNameInTitle', "Database Role");
export const DatabaseTypeDisplayNameInTitle: string = localize('objectManagement.DatabaseDisplayNameInTitle', "Database");

// Shared Strings
export const FailedToRetrieveConnectionInfoErrorMessage: string = localize('objectManagement.noConnectionUriError', "Failed to retrieve the connection information, please reconnect and try again.")
export const RenameObjectDialogTitle: string = localize('objectManagement.renameObjectDialogTitle', "Enter new name");
export const OwnerText: string = localize('objectManagement.ownerText', "Owner");
export const BrowseText = localize('objectManagement.browseText', "Browse…");
export const BrowseOwnerButtonAriaLabel = localize('objectManagement.browseForOwnerText', "Browse for an owner");
export const AddMemberAriaLabel = localize('objectManagement.addMembersText', "Add members");
export const RemoveMemberAriaLabel = localize('objectManagement.removeMemberText', "Remove selected member");
export const AddSecurableAriaLabel = localize('objectManagement.addSecurablesText', "Add securables");
export const RemoveSecurableAriaLabel = localize('objectManagement.removeSecurablesText', "Remove selected securable");
export const SecurablesText = localize('objectManagement.securablesText', "Securables");
export const ExplicitPermissionsTableLabel = localize('objectManagement.explicitPermissionsTableLabel', "Explicit permissions for selected securable");
export const EffectivePermissionsTableLabel = localize('objectManagement.effectivePermissionsTableLabel', "Effective permissions for selected securable");
export const PermissionColumnHeader = localize('objectManagement.permissionColumnHeader', "Permission");
export const GrantorColumnHeader = localize('objectManagement.grantorColumnHeader', "Grantor");
export const GrantColumnHeader = localize('objectManagement.grantColumnHeader', "Grant");
export const WithGrantColumnHeader = localize('objectManagement.withGrantColumnHeader', "With Grant");
export const DenyColumnHeader = localize('objectManagement.denyColumnHeader', "Deny");
export const SelectSecurablesDialogTitle = localize('objectManagement.selectSecurablesDialogTitle', "Select Securables");

export function ExplicitPermissionsTableLabelSelected(name: string): string { return localize('objectManagement.explicitPermissionsTableLabelSelected', "Explicit permissions for: {0}", name); }
export function EffectivePermissionsTableLabelSelected(name: string): string { return localize('objectManagement.effectivePermissionsTableLabelSelected', "Effective permissions for: {0}", name); }

export function RefreshObjectExplorerError(error: string): string {
	return localize({
		key: 'objectManagement.refreshOEError',
		comment: ['{0}: error message.']
	}, "An error occurred while while refreshing the object explorer. {0}", error);
}

export function DeleteObjectConfirmationText(objectType: string, objectName: string): string {
	return localize({
		key: 'objectManagement.deleteObjectConfirmation',
		comment: ['{0} object type, {1}: object name.']
	}, "Are you sure you want to delete the {0}: {1}?", objectType, objectName);
}

export function CreateObjectOperationDisplayName(objectType: string): string {
	return localize({
		key: 'objectManagement.createObjectOperationName',
		comment: ['{0} object type']
	}, "Create {0}", objectType);
}

export function UpdateObjectOperationDisplayName(objectType: string, objectName: string): string {
	return localize({
		key: 'objectManagement.updateObjectOperationName',
		comment: ['{0} object type, {1}: object name.']
	}, "Update {0} '{1}'", objectType, objectName);
}

export function DeleteObjectOperationDisplayName(objectType: string, objectName: string): string {
	return localize({
		key: 'objectManagement.deleteObjectOperationName',
		comment: ['{0} object type, {1}: object name.']
	}, "Delete {0} '{1}'", objectType, objectName);
}

export function DeleteObjectError(objectType: string, objectName: string, error: string): string {
	return localize({
		key: 'objectManagement.deleteObjectError',
		comment: ['{0} object type, {1}: object name, {2}: error message.']
	}, "An error occurred while deleting the {0}: {1}. {2}", objectType, objectName, error);
}

export function OpenObjectPropertiesDialogError(objectType: string, objectName: string, error: string): string {
	return localize({
		key: 'objectManagement.openObjectPropertiesDialogError',
		comment: ['{0} object type, {1}: object name, {2}: error message.']
	}, "An error occurred while opening the properties dialog for {0}: {1}. {2}", objectType, objectName, error);
}

export function OpenNewObjectDialogError(objectType: string, error: string): string {
	return localize({
		key: 'objectManagement.openNewObjectDialogError',
		comment: ['{0} object type, {1}: error message.']
	}, "An error occurred while opening the new {0} dialog. {1}", objectType, error);
}

export function NewObjectDialogTitle(objectType: string): string {
	return localize({
		key: 'objectManagement.newObjectDialogTitle',
		comment: ['{0} object type.']
	}, '{0} - New (Preview)', objectType);
}

export function ObjectPropertiesDialogTitle(objectType: string, objectName: string): string {
	return localize({
		key: 'objectManagement.objectPropertiesDialogTitle',
		comment: ['{0} object type, {1}: object name.']
	}, '{0} - {1} (Preview)', objectType, objectName);
}

export function RenameObjectOperationDisplayName(objectType: string, originalName: string, newName: string): string {
	return localize({
		key: 'objectManagement.renameObjectOperationName',
		comment: ['{0} object type, {1}: original name, {2}: new name']
	}, "Rename {0} '{1}' to '{2}'", objectType, originalName, newName);
}

export function RenameObjectError(objectType: string, originalName: string, newName: string, error: string): string {
	return localize({
		key: 'objectManagement.renameObjectError',
		comment: ['{0} object type, {1}: original name, {2}: new name, {3}: error message.']
	}, "An error occurred while renaming {0} '{1}' to '{2}'. {3}", objectType, originalName, newName, error);
}

export const NameText = localize('objectManagement.nameLabel', "Name");
export const GeneralSectionHeader = localize('objectManagement.generalSectionHeader', "General");
export const AdvancedSectionHeader = localize('objectManagement.advancedSectionHeader', "Advanced");
export const OptionsSectionHeader = localize('objectManagement.optionsSectionHeader', "Options");
export const PasswordText = localize('objectManagement.passwordLabel', "Password");
export const ConfirmPasswordText = localize('objectManagement.confirmPasswordLabel', "Confirm password");
export const EnabledText = localize('objectManagement.enabledLabel', "Enabled");
export const NameCannotBeEmptyError = localize('objectManagement.nameCannotBeEmptyError', "Name cannot be empty.");
export const PasswordCannotBeEmptyError = localize('objectManagement.passwordCannotBeEmptyError', "Password cannot be empty.");
export const PasswordsNotMatchError = localize('objectManagement.passwordsNotMatchError', "Password must match the confirm password.");
export const InvalidPasswordError = localize('objectManagement.invalidPasswordError', "Password doesn't meet the complexity requirement. For more information: https://docs.microsoft.com/sql/relational-databases/security/password-policy");
export const LoginNotSelectedError = localize('objectManagement.loginNotSelectedError', "Login is not selected.");
export const MembershipSectionHeader = localize('objectManagement.membershipLabel', "Membership");
export const MemberSectionHeader = localize('objectManagement.membersLabel', "Members");
export const SchemaText = localize('objectManagement.schemaLabel', "Schema");

// Database
export const DatabaseExistsError = (dbName: string) => localize('objectManagement.databaseExistsError', "Database '{0}' already exists. Choose a different database name.", dbName);
export const CollationText = localize('objectManagement.collationLabel', "Collation");
export const RecoveryModelText = localize('objectManagement.recoveryModelLabel', "Recovery Model");
export const CompatibilityLevelText = localize('objectManagement.compatibilityLevelLabel', "Compatibility Level");
export const ContainmentTypeText = localize('objectManagement.containmentTypeLabel', "Containment Type");


// Login
export const BlankPasswordConfirmationText: string = localize('objectManagement.blankPasswordConfirmation', "Creating a login with a blank password is a security risk.  Are you sure you want to continue?");
export const DeleteLoginConfirmationText: string = localize('objectManagement.deleteLoginConfirmation', "Deleting server logins does not delete the database users associated with the logins. To complete the process, delete the users in each database. It may be necessary to first transfer the ownership of schemas to new users.");
export const SQLAuthenticationSectionHeader = localize('objectManagement.login.sqlAuthSectionHeader', "SQL Authentication");
export const ServerRoleSectionHeader = localize('objectManagement.login.serverRoleSectionHeader', "Server Roles");
export const AuthTypeText = localize('objectManagement.login.authenticateType', "Authentication");
export const SpecifyOldPasswordText = localize('objectManagement.login.specifyOldPasswordLabel', "Specify old password");
export const OldPasswordText = localize('objectManagement.login.oldPasswordLabel', "Old password");
export const EnforcePasswordPolicyText = localize('objectManagement.login.enforcePasswordPolicyLabel', "Enforce password policy");
export const EnforcePasswordExpirationText = localize('objectManagement.login.enforcePasswordExpirationLabel', "Enforce password expiration");
export const MustChangePasswordText = localize('objectManagement.login.mustChangePasswordLabel', "User must change password at next login");
export const DefaultDatabaseText = localize('objectManagement.login.defaultDatabaseLabel', "Default database");
export const DefaultLanguageText = localize('objectManagement.login.defaultLanguageLabel', "Default language");
export const PermissionToConnectText = localize('objectManagement.login.permissionToConnectLabel', "Permission to connect to database engine");
export const LoginLockedOutText = localize('objectManagement.login.lockedOutLabel', "Login is locked out");
export const WindowsAuthenticationTypeDisplayText = localize('objectManagement.login.windowsAuthenticationType', "Windows Authentication");
export const SQLAuthenticationTypeDisplayText = localize('objectManagement.login.sqlAuthenticationType', "SQL Authentication");
export const AADAuthenticationTypeDisplayText = localize('objectManagement.login.aadAuthenticationType', "Azure Active Directory Authentication");
export const OldPasswordCannotBeEmptyError = localize('objectManagement.login.oldPasswordCannotBeEmptyError', "Old password cannot be empty.");

// User
export const UserTypeText = localize('objectManagement.user.type', "Type");
export const UserType_LoginMapped = localize('objectManagement.user.loginMapped', "Mapped to a server login");
export const UserType_WindowsUser = localize('objectManagement.user.windowsUser', "Mapped to a Windows user/group");
export const UserType_SqlAuthentication = localize('objectManagement.user.sqlAuth', "Authenticate with password");
export const UserType_AADAuthentication = localize('objectManagement.user.aadAuth', "Authenticate with Azure Active Directory");
export const UserType_NoLoginAccess = localize('objectManagement.user.noLogin', "No Login Access");
export const DefaultSchemaText = localize('objectManagement.user.defaultSchemaLabel', "Default schema");
export const LoginText = localize('objectManagement.user.loginLabel', "Login");
export const OwnedSchemaSectionHeader = localize('objectManagement.user.ownedSchemasLabel', "Owned Schemas");

// Database Role
export const SelectDatabaseRoleMemberDialogTitle = localize('objectManagement.databaseRole.SelectMemberDialogTitle', "Select Database Role Members");
export const SelectDatabaseRoleOwnerDialogTitle = localize('objectManagement.databaseRole.SelectOwnerDialogTitle', "Select Database Role Owner");

// Server Role
export const SelectServerRoleMemberDialogTitle = localize('objectManagement.serverRole.SelectMemberDialogTitle', "Select Server Role Members");
export const SelectServerRoleOwnerDialogTitle = localize('objectManagement.serverRole.SelectOwnerDialogTitle', "Select Server Role Owner");

// Find Object Dialog
export const ObjectTypeText = localize('objectManagement.objectTypeLabel', "Object Type");
export const FilterText = localize('objectManagement.filterText', "Filter");
export const FindText = localize('objectManagement.findText', "Find");
export const SelectText = localize('objectManagement.selectText', "Select");
export const ObjectsText = localize('objectManagement.objectsLabel', "Objects");
export const LoadingObjectsText = localize('objectManagement.loadingObjectsLabel', "Loading objects…");
export function LoadingObjectsCompletedText(count: number): string {
	return localize('objectManagement.loadingObjectsCompletedLabel', "Loading objects completed, {0} objects found", count);
}

// Util functions

export function getNodeTypeDisplayName(type: string, inTitle: boolean = false): string {
	switch (type) {
		case ObjectManagement.NodeType.ApplicationRole:
			return inTitle ? ApplicationRoleTypeDisplayNameInTitle : ApplicationRoleTypeDisplayName;
		case ObjectManagement.NodeType.DatabaseRole:
			return inTitle ? DatabaseRoleTypeDisplayNameInTitle : DatabaseRoleTypeDisplayName;
		case ObjectManagement.NodeType.ServerLevelLogin:
			return inTitle ? LoginTypeDisplayNameInTitle : LoginTypeDisplayName;
		case ObjectManagement.NodeType.ServerLevelServerRole:
			return inTitle ? ServerRoleTypeDisplayNameInTitle : ServerRoleTypeDisplayName;
		case ObjectManagement.NodeType.User:
			return inTitle ? UserTypeDisplayNameInTitle : UserTypeDisplayName;
		case ObjectManagement.NodeType.Table:
			return TableTypeDisplayName;
		case ObjectManagement.NodeType.View:
			return ViewTypeDisplayName;
		case ObjectManagement.NodeType.Column:
			return ColumnTypeDisplayName;
		case ObjectManagement.NodeType.Database:
			return inTitle ? DatabaseTypeDisplayNameInTitle : DatabaseTypeDisplayName;
		default:
			throw new Error(`Unknown node type: ${type}`);
	}
}

const AuthencationTypeDisplayNameMap = new Map<ObjectManagement.AuthenticationType, string>();
AuthencationTypeDisplayNameMap.set(ObjectManagement.AuthenticationType.Windows, WindowsAuthenticationTypeDisplayText);
AuthencationTypeDisplayNameMap.set(ObjectManagement.AuthenticationType.Sql, SQLAuthenticationTypeDisplayText);
AuthencationTypeDisplayNameMap.set(ObjectManagement.AuthenticationType.AzureActiveDirectory, AADAuthenticationTypeDisplayText);

export function getAuthenticationTypeDisplayName(authType: ObjectManagement.AuthenticationType): string {
	if (AuthencationTypeDisplayNameMap.has(authType)) {
		return AuthencationTypeDisplayNameMap.get(authType);
	}
	throw new Error(`Unknown authentication type: ${authType}`);
}

export function getAuthenticationTypeByDisplayName(displayName: string): ObjectManagement.AuthenticationType {
	for (let [key, value] of AuthencationTypeDisplayNameMap.entries()) {
		if (value === displayName)
			return key;
	}
	throw new Error(`Unknown authentication type display name: ${displayName}`);
}

const UserTypeDisplayNameMap = new Map<ObjectManagement.UserType, string>();
UserTypeDisplayNameMap.set(ObjectManagement.UserType.LoginMapped, UserType_LoginMapped);
UserTypeDisplayNameMap.set(ObjectManagement.UserType.WindowsUser, UserType_WindowsUser);
UserTypeDisplayNameMap.set(ObjectManagement.UserType.SqlAuthentication, UserType_SqlAuthentication);
UserTypeDisplayNameMap.set(ObjectManagement.UserType.AADAuthentication, UserType_AADAuthentication);
UserTypeDisplayNameMap.set(ObjectManagement.UserType.NoLoginAccess, UserType_NoLoginAccess);

export function getUserTypeDisplayName(userType: ObjectManagement.UserType): string {
	if (UserTypeDisplayNameMap.has(userType)) {
		return UserTypeDisplayNameMap.get(userType);
	}
	throw new Error(`Unknown user type: ${userType}`);
}

export function getUserTypeByDisplayName(displayName: string): ObjectManagement.UserType {
	for (let [key, value] of UserTypeDisplayNameMap.entries()) {
		if (value === displayName)
			return key;
	}
	throw new Error(`Unknown user type display name: ${displayName}`);
}

export function getObjectTypeInfo(typeNames: string[]): ObjectTypeInfo[] {
	return typeNames.map(typeName => {
		return {
			name: typeName,
			displayName: getNodeTypeDisplayName(typeName, true)
		};
	});
}
