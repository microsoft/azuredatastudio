/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ObjectManagement } from 'mssql';
import { ObjectTypeInfo } from './ui/findObjectDialog';
import { AuthenticationType, UserType } from './interfaces';
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
export const ServerTypeDisplayName: string = localize('objectManagement.ServerDisplayName', "Server");
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
	}, "An error occurred while refreshing the object explorer. {0}", error);
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
export const ConfigureSLOSectionHeader = localize('objectManagement.configureSLOSectionHeader', "Configure SLO");
export const BackupRedundancyText = localize('objectManagement.backupRedundancyLabel', "Backup Storage Redundancy");
export const CurrentSLOText = localize('objectManagement.currentSLOLabel', "Current Service Level Objective");
export const EditionText = localize('objectManagement.editionLabel', "Edition");
export const MaxSizeText = localize('objectManagement.maxSizeLabel', "Max Size");
export const AzurePricingLinkText = localize('objectManagement.azurePricingLink', "Azure SQL Database pricing calculator");

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
export const ObjectTypesText = localize('objectManagement.objectTypesLabel', "Object Types");
export const FilterSectionTitle = localize('objectManagement.filterSectionTitle', "Filters");
export const ObjectTypeText = localize('objectManagement.objectTypeLabel', "Object Type");
export const SearchTextLabel = localize('objectManagement.SearchTextLabel', "Search Text");
export const FindText = localize('objectManagement.findText', "Find");
export const SelectText = localize('objectManagement.selectText', "Select");
export const ObjectsText = localize('objectManagement.objectsLabel', "Objects");
export const LoadingObjectsText = localize('objectManagement.loadingObjectsLabel', "Loading objects…");
export function LoadingObjectsCompletedText(count: number): string {
	return localize('objectManagement.loadingObjectsCompletedLabel', "Loading objects completed, {0} objects found", count);
}

// ObjectSelectionMethodDialog
export const ObjectSelectionMethodDialogTitle = localize('objectManagement.objectSelectionMethodDialogTitle', "Add Objects");
export const ObjectSelectionMethodDialog_TypeLabel = localize('objectManagement.ObjectSelectionMethodDialog_TypeLabel', "How do you want to add objects?");
export const ObjectSelectionMethodDialog_SpecificObjects = localize('objectManagement.ObjectSelectionMethodDialog_SpecificObjects', "Specific objects…");
export const ObjectSelectionMethodDialog_AllObjectsOfTypes = localize('objectManagement.ObjectSelectionMethodDialog_AllObjectsOfTypes', "All objects of certain types");
export const ObjectSelectionMethodDialog_AllObjectsOfSchema = localize('objectManagement.ObjectSelectionMethodDialog_AllObjectsOfSchema', "All objects belonging to a schema");
export const ObjectSelectionMethodDialog_SelectSchemaDropdownLabel = localize('objectManagement.ObjectSelectionMethodDialog_SelectSchemaDropdownLabel', "Schema");

// Server Properties Dialog
export const PropertiesHeader = localize('objectManagement.properties', "Properties");
export const HardwareGenerationText = localize('objectManagement.hardwareGeneration', "Hardware Generation");
export const LanguageText = localize('objectManagement.language', "Language");
export const MemoryText = localize('objectManagement.memory', "Memory");
export const OperatingSystemText = localize('objectManagement.operatingSystem', "Operating System");
export const PlatformText = localize('objectManagement.platform', "Platform");
export const ProcessorsText = localize('objectManagement.processors', "Processors");
export const IsClusteredText = localize('objectManagement.isClustered', "Is Clustered");
export const IsHadrEnabledText = localize('objectManagement.isHadrEnabled', "Is HADR Enabled");
export const IsPolyBaseInstalledText = localize('objectManagement.isPolyBaseInstalled', "Is PolyBase Installed");
export const IsXTPSupportedText = localize('objectManagement.isXTPSupported', "Is XTP Supported");
export const ProductText = localize('objectManagement.product', "Product");
export const ReservedStorageSizeInMBText = localize('objectManagement.reservedStorageSizeInMB', "Reserved Storage Size");
export const RootDirectoryText = localize('objectManagement.rootDirectory', "Root Directory");
export const ServerCollationText = localize('objectManagement.serverCollation', "Server Collation");
export const ServiceTierText = localize('objectManagement.serviceTier', "Service Tier");
export const StorageSpaceUsageInGBText = localize('objectManagement.storageSpaceUsageInGB', "Storage Space Usage");
export const VersionText = localize('objectManagement.versionText', "Version");


export const minServerMemoryText = localize('objectManagement.minServerMemoryText', "Minimum Server Memory (MB)");
export const maxServerMemoryText = localize('objectManagement.maxServerMemoryText', "Maximum Server Memory (MB)");
//Database properties Dialog
export const LastDatabaseBackupText = localize('objectManagement.lastDatabaseBackup', "Last Database Backup");
export const LastDatabaseLogBackupText = localize('objectManagement.lastDatabaseLogBackup', "Last Database Log Backup");
export const BackupSectionHeader = localize('objectManagement.databaseProperties.backupSectionHeader', "Backup");
export const AutomaticSectionHeader = localize('objectManagement.databaseProperties.automaticSectionHeader', "Automatic");
export const LedgerSectionHeader = localize('objectManagement.databaseProperties.ledgerSectionHeader', "Ledger");
export const RecoverySectionHeader = localize('objectManagement.databaseProperties.recoverySectionHeader', "Recovery");
export const StateSectionHeader = localize('objectManagement.databaseProperties.stateSectionHeader', "State");
export const DatabaseSectionHeader = localize('objectManagement.databaseProperties.databaseSectionHeader', "Database");
export const NamePropertyText = localize('objectManagement.databaseProperties.name', "Name");
export const StatusText = localize('objectManagement.databaseProperties.status', "Status");
export const OwnerPropertyText = localize('objectManagement.databaseProperties.owner', "Owner");
export const DateCreatedText = localize('objectManagement.databaseProperties.dateCreated', "Date Created");
export const SizeText = localize('objectManagement.databaseProperties.size', "Size");
export const SpaceAvailableText = localize('objectManagement.databaseProperties.spaceAvailable', "Space Available");
export const NumberOfUsersText = localize('objectManagement.databaseProperties.numberOfUsers', "Number of Users");
export const MemoryAllocatedText = localize('objectManagement.databaseProperties.memoryAllocated', "Memory Allocated To Memory Optimized Objects");
export const MemoryUsedText = localize('objectManagement.databaseProperties.memoryUsed', "Memory Used By Memory Optimized Objects");
export const StringValueInMB = (value: string) => localize('objectManagement.databaseProperties.mbUnitText', "{0} MB", value);
export const AutoCreateIncrementalStatisticsText = localize('objectManagement.databaseProperties.autoCreateIncrementalStatisticsText', "Auto Create Incremental Statistics");
export const AutoCreateStatisticsText = localize('objectManagement.databaseProperties.AutoCreateStatisticsText', "Auto Create Statistics");
export const AutoShrinkText = localize('objectManagement.databaseProperties.autoShrinkText', "Auto Shrink");
export const AutoUpdateStatisticsText = localize('objectManagement.databaseProperties.autoUpdateStatisticsText', "Auto Update Statistics");
export const AutoUpdateStatisticsAsynchronouslyText = localize('objectManagement.databaseProperties.autoUpdateStatisticsAsynchronouslyText', "Auto Update Statistics Asynchronously");
export const IsLedgerDatabaseText = localize('objectManagement.databaseProperties.isLedgerDatabaseText', "Is Ledger Database");
export const PageVerifyText = localize('objectManagement.databaseProperties.pageVerifyText', "Page Verify");
export const TargetRecoveryTimeInSecondsText = localize('objectManagement.databaseProperties.targetRecoveryTimeInSecondsText', "Target Recovery Time (Seconds)");
export const DatabaseReadOnlyText = localize('objectManagement.databaseProperties.databaseReadOnlyText', "Database Read-Only");
export const DatabaseStateText = localize('objectManagement.databaseProperties.databaseStateText', "Database State");
export const EncryptionEnabledText = localize('objectManagement.databaseProperties.encryptionEnabledText', "Encryption Enabled");
export const RestrictAccessText = localize('objectManagement.databaseProperties.restrictAccessText', "Restrict Access");
export const SqlManagedInstance = localize('objectManagement.databaseProperties.sqlManagedInstance', "SqlManagedInstance");
export const ExpressEdition = localize('objectManagement.databaseProperties.expressEdition', "Express");


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
		case ObjectManagement.NodeType.Server:
			return ServerTypeDisplayName;
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

const AuthencationTypeDisplayNameMap = new Map<AuthenticationType, string>();
AuthencationTypeDisplayNameMap.set(AuthenticationType.Windows, WindowsAuthenticationTypeDisplayText);
AuthencationTypeDisplayNameMap.set(AuthenticationType.Sql, SQLAuthenticationTypeDisplayText);
AuthencationTypeDisplayNameMap.set(AuthenticationType.AzureActiveDirectory, AADAuthenticationTypeDisplayText);

export function getAuthenticationTypeDisplayName(authType: AuthenticationType): string {
	if (AuthencationTypeDisplayNameMap.has(authType)) {
		return AuthencationTypeDisplayNameMap.get(authType);
	}
	throw new Error(`Unknown authentication type: ${authType}`);
}

export function getAuthenticationTypeByDisplayName(displayName: string): AuthenticationType {
	for (let [key, value] of AuthencationTypeDisplayNameMap.entries()) {
		if (value === displayName)
			return key;
	}
	throw new Error(`Unknown authentication type display name: ${displayName}`);
}

const UserTypeDisplayNameMap = new Map<UserType, string>();
UserTypeDisplayNameMap.set(UserType.LoginMapped, UserType_LoginMapped);
UserTypeDisplayNameMap.set(UserType.WindowsUser, UserType_WindowsUser);
UserTypeDisplayNameMap.set(UserType.SqlAuthentication, UserType_SqlAuthentication);
UserTypeDisplayNameMap.set(UserType.AADAuthentication, UserType_AADAuthentication);
UserTypeDisplayNameMap.set(UserType.NoLoginAccess, UserType_NoLoginAccess);

export function getUserTypeDisplayName(userType: UserType): string {
	if (UserTypeDisplayNameMap.has(userType)) {
		return UserTypeDisplayNameMap.get(userType);
	}
	throw new Error(`Unknown user type: ${userType}`);
}

export function getUserTypeByDisplayName(displayName: string): UserType {
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
