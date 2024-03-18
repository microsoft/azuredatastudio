/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
export function NoDialogFoundError(nodeType: string, objectType: string): string { return localize('objectManagement.noDialogFoundError', "Could not find a supported dialog for node type '{0}' and object type '{1}'.", nodeType, objectType); }
export function NotSupportedError(objectType: string): string { return localize('objectManagement.notSupportedError', "This command is not supported for object type '{0}'.", objectType); }

// Shared Strings
export const FailedToRetrieveConnectionInfoErrorMessage: string = localize('objectManagement.noConnectionUriError', "Failed to retrieve the connection information, please reconnect and try again.");
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
export const AddFileAriaLabel = localize('objectManagement.addFileText', "Add database files");
export const RemoveFileAriaLabel = localize('objectManagement.removeFileText', "Remove database file");
export const CreateObjectLabel = localize('objectManagement.createObjectLabel', "Create");
export const ApplyUpdatesLabel = localize('objectManagement.applyUpdatesLabel', "Apply");
export const allFiles = localize('objectManagement.allFiles', "All Files");
export const labelSelectFolder = localize('objectManagement.labelSelectFolder', "Select Folder");
export const DataFileLabel = localize('objectManagement.dataFileLabel', "Data");
export const LogFileLabel = localize('objectManagement.logFileLabel', "Log");
export const BackButtonLabel = localize('objectManagement.backButtonLabel', "Back");
export const NoSecurableObjectsFoundInfoMessage: string = localize('objectManagement.noSecurableObjectsFoundInfoMessage', "No securable objects could be found for the specified selection.");
export const BrowseFilesLabel = localize('objectManagement.browseFilesLabel', "Browse files");

export function ExplicitPermissionsTableLabelSelected(name: string): string { return localize('objectManagement.explicitPermissionsTableLabelSelected', "Explicit permissions for: {0}", name); }
export function EffectivePermissionsTableLabelSelected(name: string): string { return localize('objectManagement.effectivePermissionsTableLabelSelected', "Effective permissions for: {0}", name); }

export function RefreshObjectExplorerError(error: string): string {
	return localize({
		key: 'objectManagement.refreshOEError',
		comment: ['{0}: error message.']
	}, "An error occurred while refreshing the object explorer. {0}", error);
}

export function DropObjectConfirmationText(objectType: string, objectName: string): string {
	return localize({
		key: 'objectManagement.dropObjectConfirmation',
		comment: ['{0} object type, {1}: object name.']
	}, "Are you sure you want to drop the {0}: {1}?", objectType, objectName);
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

export function DropObjectOperationDisplayName(objectType: string, objectName: string): string {
	return localize({
		key: 'objectManagement.dropObjectOperationName',
		comment: ['{0} object type, {1}: object name.']
	}, "Drop {0} '{1}'", objectType, objectName);
}

export function DropObjectError(objectType: string, objectName: string, error: string): string {
	return localize({
		key: 'objectManagement.dropObjectError',
		comment: ['{0} object type, {1}: object name, {2}: error message.']
	}, "An error occurred while dropping the {0}: {1}. {2}", objectType, objectName, error);
}

export function OpenDetachDatabaseDialogError(error: string): string {
	return localize({
		key: 'objectManagement.openDetachDatabaseDialogError',
		comment: ['{0}: error message.']
	}, "An error occurred while opening the detach database dialog. {0}", error);
}

export function OpenBackupDatabaseDialogError(error: string): string {
	return localize({
		key: 'objectManagement.openBackupDatabaseDialogError',
		comment: ['{0}: error message.']
	}, "An error occurred while opening the backup database dialog. {0}", error);
}

export function DetachDatabaseOperationDisplayName(objectName: string): string {
	return localize({
		key: 'objectManagement.detachDatabaseOperationName',
		comment: ['{0}: object name.']
	}, "Detach database '{0}'", objectName);
}

export function OpenDropDatabaseDialogError(error: string): string {
	return localize({
		key: 'objectManagement.openDropDatabaseDialogError',
		comment: ['{0}: error message.']
	}, "An error occurred while opening the drop database dialog. {0}", error);
}

export function OpenAttachDatabaseDialogError(error: string): string {
	return localize({
		key: 'objectManagement.openAttachDatabaseDialogError',
		comment: ['{0}: error message.']
	}, "An error occurred while opening the attach database dialog. {0}", error);
}

export const AttachDatabaseOperationDisplayName = localize('objectManagement.attachDatabaseOperationName', "Attach database");

export function BackupDatabaseOperationDisplayName(objectName: string): string {
	return localize({
		key: 'objectManagement.backupDatabaseOperationName',
		comment: ['{0}: object name.']
	}, "Backup database '{0}'", objectName);
}

export function OpenRestoreDatabaseDialogError(error: string): string {
	return localize({
		key: 'objectManagement.openRestoreDatabaseDialogError',
		comment: ['{0}: error message.']
	}, "An error occurred while opening the restore database dialog. {0}", error);
}

export function RestoreDatabaseOperationDisplayName(objectName: string): string {
	return localize({
		key: 'objectManagement.restoreDatabaseOperationName',
		comment: ['{0}: object name.']
	}, "Restore database '{0}'", objectName);
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
	}, '{0} Properties (Preview) - {1}', objectType, objectName);
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
export const FilesSectionHeader = localize('objectManagement.filesSectionHeader', "Files");
export const FileGroupsSectionHeader = localize('objectManagement.filegroupsSectionHeader', "Filegroups");
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
export const CollationNotValidError = (collationName: string) => localize('objectManagement.collationNotValidError', "The selected collation '{0}' is not valid. Please choose a different collation.", collationName);
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
export const DetachDatabaseDialogTitle = (dbName: string) => localize('objectManagement.detachDatabaseDialogTitle', "Detach Database - {0} (Preview)", dbName);
export const RestoreDatabaseDialogTitle = localize('objectManagement.restoreDatabaseDialogTitle', "Restore Database (Preview)");
export const DetachDropConnections = localize('objectManagement.detachDropConnections', "Drop connnections");
export const DetachUpdateStatistics = localize('objectManagement.detachUpdateStatistics', "Update statistics");
export const DatabaseFilesLabel = localize('objectManagement.databaseFiles', "Database Files");
export const DatabaseFileNameLabel = localize('objectManagement.databaseFileName', "Name");
export const DatabaseFileTypeLabel = localize('objectManagement.databaseFileType', "Type");
export const DatabaseFilePathLabel = localize('objectManagement.databaseFilePath', "Path");
export const DatabaseFileGroupLabel = localize('objectManagement.databaseFileGroup', "File Group");
export const DetachDatabaseOptions = localize('objectManagement.detachDatabaseOptions', "Detach Database Options");
export const DetachButtonLabel = localize('objectManagement.detachButtonLabel', "Detach");
export const AttachDatabaseDialogTitle = localize('objectManagement.attachDatabaseDialogTitle', "Attach Database (Preview)");
export const NoDatabaseFilesError = localize('objectManagement.doDatabaseFilesError', "No database files were specified to attach to the server.");
export const DatabasesToAttachLabel = localize('objectManagement.databasesToAttach', "Databases to Attach");
export const AssociatedFilesLabel = localize('objectManagement.associatedDatabaseFiles', "Associated Database Files");
export const MdfFileLocation = localize('objectManagement.mdfFileLocation', "MDF File Location");
export const DatabaseFilesFilterLabel = localize('objectManagement.databaseFilesFilterLabel', "Database Data Files");
export const DatabaseName = localize('objectManagement.databaseName', "DB Name");
export const AttachAsText = localize('objectManagement.attachAsText', "Attach As");
export const AttachButtonLabel = localize('objectManagement.attachButtonLabel', "Attach");
export const DropDatabaseDialogTitle = (dbName: string) => localize('objectManagement.dropDatabaseDialogTitle', "Drop Database - {0} (Preview)", dbName);
export const DropButtonLabel = localize('objectManagement.dropButtonLabel', "Drop");
export const DropDatabaseOptions = localize('objectManagement.dropDatabaseOptions', "Drop Database Options");
export const CloseConnections = localize('objectManagement.closeConnections', "Close existing connections");
export const DeleteBackupHistory = localize('objectManagement.deleteBackupHistory', "Delete backup and restore history information for database");
export const DatabaseDetailsLabel = localize('objectManagement.databaseDetails', "Database Details");

// Backup database
export const BackupDatabaseDialogTitle = (dbName: string) => localize('objectManagement.backupDatabaseDialogTitle', "Backup Database - {0} (Preview)", dbName);
export const BackupButtonLabel = localize('objectManagement.backupButtonLabel', "Backup");
export const BackupOverwriteMediaLabel = localize('objectManagement.backupOverwriteMedia', "Overwrite media");
export const BackupCompressionLabel = localize('objectManagement.backupCompression', "Compression");
export const BackupEncryptionLabel = localize('objectManagement.backupEncryption', "Encryption");
export const BackupTransactionLog = localize('objectManagement.backupTransactionLog', "Transaction Log");
export const BackupReliabilityLabel = localize('objectManagement.backupReliability', "Reliability");
export const BackupExpirationLabel = localize('objectManagement.backupExpiration', "Expiration");
export const AddBackupFileAriaLabel = localize('objectManagement.addBackupFileText', "Add backup files");
export const RemoveBackupFileAriaLabel = localize('objectManagement.removeBackupFileText', "Remove backup file");
export const BackupFilesLabel = localize('objectManagement.backupFilesLabel', "Backup Files");
export const BackupToUrlLabel = localize('objectManagement.backupToUrlLabel', "Backup URL");
export const BackupNameLabel = localize('objectManagement.backupNameLabel', "Backup set name");
export const BackupRecoveryLabel = localize('objectManagement.backupRecoveryLabel', "Recovery model");
export const BackupTypeLabel = localize('objectManagement.backupTypeLabel', "Backup type");
export const BackupCopyLabel = localize('objectManagement.backupCopyLabel', "Copy-only backup");
export const BackupDiskLabel = localize('objectManagement.backupDiskLabel', "Disk");
export const BackupUrlLabel = localize('objectManagement.backupUrlLabel', "URL");
export const BackupToLabel = localize('objectManagement.backupToLabel', "Back up to");
export const BackupServerCertificate = localize('objectManagement.backupServerCertificate', "Server Certificate");
export const BackupAsymmetricKey = localize('objectManagement.backupAsymmetricKey', "Asymmetric Key");
export const BackupFull = localize('objectManagement.backupFull', "Full");
export const BackupDifferential = localize('objectManagement.backupDifferential', "Differential");
export const BackupToExistingMedia = localize('objectManagement.backupToExistingMedia', "Back up to the existing media set");
export const AppendToExistingBackup = localize('objectManagement.appendToExistingBackup', "Append to the existing backup set");
export const OverwriteExistingBackups = localize('objectManagement.overwriteExistingBackups', "Overwrite all existing backup sets");
export const BackupAndEraseExisting = localize('objectManagement.backupAndEraseExisting', "Back up to a new media set, and erase all existing backup sets");
export const BackupNewMediaName = localize('objectManagement.backupNewMediaName', "New media set name");
export const BackupNewMediaDescription = localize('objectManagement.backupNewMediaDescription', "New media set description");
export const VerifyBackupWhenFinished = localize('objectManagement.verifyBackupWhenFinished', "Verify backup when finished");
export const BackupPerformChecksum = localize('objectManagement.backupPerformChecksum', "Perform checksum before writing to media");
export const BackupContinueOnError = localize('objectManagement.backupContinueOnError', "Continue on error");
export const BackupTruncateLog = localize('objectManagement.backupTruncateLog', "Truncate the transaction log");
export const BackupLogTail = localize('objectManagement.backupLogTail', "Back up the tail of the log, and leave the database in the restoring state");
export const TransactionLogNotice = localize('objectManagement.transactionLogNotice', "Transaction Log options are only available only when Backup Type is set to Tansaction Log above.");
export const BackupSetCompression = localize('objectManagement.backupCompression', "Set backup compression");
export const EncryptBackup = localize('objectManagement.encryptBackup', "Encrypt backup");
export const BackupAlgorithm = localize('objectManagement.backupAlgorithm', "Algorithm");
export const BackupCertificate = localize('objectManagement.backupCertificate', "Certificate or Asymmetric key");
export const NoEncryptorWarning = localize('objectManagement.noEncryptorWarning', "No certificate or asymmetric key is available")
export const BackupEncryptNotice = localize('objectManagement.backupEncryptNotice', "Encryption options are only available when 'Back up to a new media set' is selected above.");
export const BackupDefaultSetting = localize('objectManagement.backupDefaultSetting', "Use the default server setting");
export const CompressBackup = localize('objectManagement.compressBackup', "Compress backup");
export const DontCompressBackup = localize('objectManagement.dontCompressBackup', "Do not compress backup");
export const RecoveryModelSimple = localize('objectManagement.recoveryModelSimple', "Simple");
export const PathAlreadyAddedError = localize('objectManagement.pathAlreadyAddedError', "Provided path has already been added to the files list.");
export const ScriptingFailedError = localize('objectManagement.scriptingFailedError', "Script operation failed.");
export const BackupFailedError = localize('objectManagement.backupFailedError', "Backup operation failed.");

// Login
export const BlankPasswordConfirmationText: string = localize('objectManagement.blankPasswordConfirmation', "Creating a login with a blank password is a security risk.  Are you sure you want to continue?");
export const DropLoginConfirmationText: string = localize('objectManagement.dropLoginConfirmation', "Dropping server logins does not drop the database users associated with the logins. To complete the process, drop the users in each database. It may be necessary to first transfer the ownership of schemas to new users.");
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
export const AADAuthenticationTypeDisplayText = localize('objectManagement.login.aadAuthenticationType', "Microsoft Entra ID Authentication");
export const OldPasswordCannotBeEmptyError = localize('objectManagement.login.oldPasswordCannotBeEmptyError', "Old password cannot be empty.");

// Restore Database
export const RestoreFromText = localize('objectManagement.restoreDatabase.restoreFromText', "Restore from");
export const BackupFilePathText = localize('objectManagement.restoreDatabase.backupFilePathText', "Backup file path");
export const DatabaseText = localize('objectManagement.restoreDatabase.databaseText', "Database");
export const TargetDatabaseText = localize('objectManagement.restoreDatabase.targetDatabaseText', "Target database");
export const RestoreToText = localize('objectManagement.restoreDatabase.restoreToText', "Restore to");
export const SourceSectionText = localize('objectManagement.restoreDatabase.SourceSectionText', "Source");
export const DestinationSectionText = localize('objectManagement.restoreDatabase.DestinationSectionText', "Destination");
export const RestorePlanSectionText = localize('objectManagement.restoreDatabase.RestorePlanSectionText', "Restore plan");
export const RestoreFromBackupFileOptionText = localize('objectManagement.restoreDatabase.restoreFromBackupFileOptionText', "Backup file");
export const RestoreFromDatabaseOptionText = localize('objectManagement.restoreDatabase.restoreFromDatabaseOptionText', "Database");
export const RestoreFromUrlText = localize('objectManagement.restoreDatabase.restoreFromUrlText', "URL");
export const RestoreFromS3UrlText = localize('objectManagement.restoreDatabase.restoreFromS3UrlText', "S3 URL");
export const BackupFolderPathTitle = localize('objectManagement.restoreDatabase.backupFolderPathTitle', "Please enter one or more file paths separated by commas");
export const RestoreDatabaseFilesAsText = localize('objectManagement.restoreDatabase.restoreDatabaseFilesAsText', "Restore database files as");
export const RestoreDatabaseFileDetailsText = localize('objectManagement.restoreDatabase.restoreDatabaseFileDetailsText', "Restore database file Details");
export const RestoreOptionsText = localize('objectManagement.restoreDatabase.restoreOptionsText', "Restore Options");
export const RestoreTailLogBackupText = localize('objectManagement.restoreDatabase.restoreTailLogBackupOptionsText', "Tail-log backup");
export const RestoreServerConnectionsOptionsText = localize('objectManagement.restoreDatabase.restoreServerConnectionsOptionsText', "Server connections");
export const RelocateAllFilesText = localize('objectManagement.restoreDatabase.relocateAllFilesText', "Relocate All Files");
export const DataFileFolderText = localize('objectManagement.restoreDatabase.dataFileFolderText', "Data File Folder");
export const LogFileFolderText = localize('objectManagement.restoreDatabase.logFileFolderText', "Log File Folder");
export const OverwriteTheExistingDatabaseText = localize('objectManagement.restoreDatabase.overwriteTheExistingDatabaseText', "Overwrite the existing database (WITH REPLACE)");
export const PreserveReplicationSettingsText = localize('objectManagement.restoreDatabase.preserveReplicationSettingsText', "Preserve the replication settings (WITH KEEP_REPLICATION)");
export const RestrictAccessToRestoredDBText = localize('objectManagement.restoreDatabase.restrictAccessToRestoredDBText', "Restrict access to the restored database (WITH RESTRICTED_USER)");
export const RecoveryStateText = localize('objectManagement.restoreDatabase.recoveryStateText', "Recovery State");
export const StandbyFileText = localize('objectManagement.restoreDatabase.standbyFileText', "Standby file");
export const TakeTailLogBackupBeforeRestoreText = localize('objectManagement.restoreDatabase.takeTailLogBackupBeforeRestoreText', "Take tail-log backup before restore");
export const LeaveSourceDBText = localize('objectManagement.restoreDatabase.leaveSourceDBText', "Leave source database in the restoring state (WITH NORECOVERY)");
export const TailLogBackupFileText = localize('objectManagement.restoreDatabase.tailLogBackupFileText', "Tail Log Backup File");
export const CloseExistingConnectionText = localize('objectManagement.restoreDatabase.closeExistingConnectionText', "Close existing connections to destination database");
export const RestoreText = localize('objectManagement.restoreDatabase.restorePlan.restoreText', "Restore");
export const ComponentText = localize('objectManagement.restoreDatabase.restorePlan.componentText', "Component");
export const TypeText = localize('objectManagement.restoreDatabase.restorePlan.typeText', "Type");
export const ServerText = localize('objectManagement.restoreDatabase.restorePlan.serverText', "Server");
export const PositionText = localize('objectManagement.restoreDatabase.restorePlan.positionText', "Position");
export const FirstLSNText = localize('objectManagement.restoreDatabase.restorePlan.firstLSNText', "First LSN");
export const LastLSNText = localize('objectManagement.restoreDatabase.restorePlan.lastLSNText', "Last LSN");
export const CheckpointLSNText = localize('objectManagement.restoreDatabase.restorePlan.checkpointLSNText', "Checkpoint LSN");
export const FullLSNText = localize('objectManagement.restoreDatabase.restorePlan.FullLSNText', "Full LSN");
export const StartDateText = localize('objectManagement.restoreDatabase.restorePlan.startDateText', "Start Date");
export const FinishDateText = localize('objectManagement.restoreDatabase.restorePlan.FinishDateText', "Finish Date");
export const UserNameText = localize('objectManagement.restoreDatabase.restorePlan.userNameText', "User Name");
export const ExpirationText = localize('objectManagement.restoreDatabase.restorePlan.expirationText', "Expiration");
export const LogicalFileNameText = localize('objectManagement.restoreDatabase.restorePlan.logicalFileNameText', "Logical File Name");
export const OriginalFileNameText = localize('objectManagement.restoreDatabase.restorePlan.originalFileNameText', "Original File Name");
export const RestoreAsText = localize('objectManagement.restoreDatabase.restorePlan.restoreAsText', "Restore As");
export const DatabaseAlreadyExists = (dbName: string) => localize('objectManagement.restoreDatabase', "Database '{0}' already exists. Choose a different database name.", dbName);


// User
export const UserTypeText = localize('objectManagement.user.type', "Type");
export const UserType_LoginMapped = localize('objectManagement.user.loginMapped', "Mapped to a server login");
export const UserType_WindowsUser = localize('objectManagement.user.windowsUser', "Mapped to a Windows user/group");
export const UserType_SqlAuthentication = localize('objectManagement.user.sqlAuth', "Authenticate with password");
export const UserType_AADAuthentication = localize('objectManagement.user.aadAuth', "Authenticate with Microsoft Entra");
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
export const ReservedStorageSizeInMBText = localize('objectManagement.reservedStorageSizeInMB', "Reserved Storage Size (MB)");
export const RootDirectoryText = localize('objectManagement.rootDirectory', "Root Directory");
export const ServerCollationText = localize('objectManagement.serverCollation', "Server Collation");
export const ServiceTierText = localize('objectManagement.serviceTier', "Service Tier");
export const StorageSpaceUsageInMBText = localize('objectManagement.storageSpaceUsageInMB', "Storage Space Usage (MB)");
export const VersionText = localize('objectManagement.versionText', "Version");
export const minServerMemoryText = localize('objectManagement.minServerMemoryText', "Minimum Server Memory (MB)");
export const maxServerMemoryText = localize('objectManagement.maxServerMemoryText', "Maximum Server Memory (MB)");
export const autoSetProcessorAffinityMaskForAllText = localize('objectManagement.autoSetProcessorAffinityMaskForAll', "Automatically set processor affinity mask for all processors");
export const autoSetProcessorAffinityIOMaskForAllText = localize('objectManagement.autoSetProcessorAffinityIOMaskForAll', "Automatically set I/O affinity mask for all processors");
export const processorColumnText = localize('objectManagement.processorColumn', "Processor");
export const processorAffinityColumnText = localize('objectManagement.processorAffinityColumn', "Processor Affinity");
export const processorIOAffinityColumnText = localize('objectManagement.processorIOAffinityColumn', "I/O Affinity");
export const processorLabel = localize('objectManagement.processorLabel', "Processor Affinity Table");
export const serverMemoryMaxLowerThanMinInputError: string = localize('objectManagement.serverMemoryMaxLowerThanMinInputError', "Maximum server memory cannot be lower than minimum server memory");
export const serverNumaNodeLabel = (value: string) => localize('objectManagement.serverNumaNodeLabel', "Numa Node {0}", value);
export const serverCPULabel = (value: string) => localize('objectManagement.serverCPULabel', "CPU {0}", value);
export const securityText = localize('objectManagement.security', "Security");
export const serverAuthenticationText = localize('objectManagement.serverAuthenticationText', "Server authentication");
export const onlyWindowsAuthModeText = localize('objectManagement.onlyWindowsAuthModeText', "Windows Authentication mode");
export const sqlServerAndWindowsAuthText = localize('objectManagement.sqlServerAndWindowsAuthText', "SQL Server and Windows Authentication mode");
export const loginAuditingText = localize('objectManagement.loginAuditingText', "Login auditing");
export const noLoginAuditingText = localize('objectManagement.noLoginAuditingText', "None");
export const failedLoginsOnlyText = localize('objectManagement.failedLoginsOnlyText', "Failed logins only");
export const successfulLoginsOnlyText = localize('objectManagement.successfulLoginsOnlyText', "Successful logins only");
export const bothFailedAndSuccessfulLoginsText = localize('objectManagement.bothFailedAndSuccessfulLoginsText', "Both failed and successful logins");
export const needToRestartServer = localize('objectManagement.needToRestartServer', "Changes require server restart in order to be effective");
export const logLocationText = localize('objectManagement.logLocationText', "Log");
export const dataLocationText = localize('objectManagement.dataLocationText', "Data");
export const backupLocationText = localize('objectManagement.backupLocationText', "Backup");
export const defaultLocationsLabel = localize('objectManagement.defaultLocationsLabel', "Database default locations");
export const databaseSettingsText = localize('objectManagement.databaseSettings', "Database Settings");
export const compressBackupText = localize('objectManagement.compressBackupText', "Compress Backup");
export const backupChecksumText = localize('objectManagement.backupChecksumText', "Backup checksum");
export const backupAndRestoreText = localize('objectManagement.backupAndRestoreText', "Backup and Restore");
export const allowTriggerToFireOthersLabel = localize('objectManagement.allowTriggerToFireOthersLabel', "Allow Triggers to Fire Others");
export const blockedProcThresholdLabel = localize('objectManagement.blockedProcThresholdLabel', "Blocked Process Threshold");
export const cursorThresholdLabel = localize('objectManagement.cursorThresholdLabel', "Cursor Threshold");
export const defaultFullTextLanguageLabel = localize('objectManagement.defaultFullTextLanguageLabel', "Default Full-Text Language");
export const defaultLanguageLabel = localize('objectManagement.defaultLanguageLabel', "Default Language");
export const fullTextUpgradeOptionLabel = localize('objectManagement.fullTextUpgradeOptionLabel', "Full-Text Upgrade Option");
export const maxTextReplicationSizeLabel = localize('objectManagement.maxTextReplicationSizeLabel', "Max Text Replication Size");
export const optimizeAdHocWorkloadsLabel = localize('objectManagement.optimizeAdHocWorkloadsLabel', "Optimize Ad Hoc Workloads");
export const scanStartupProcsLabel = localize('objectManagement.scanStartupProcsLabel', "Scan Startup Procs ");
export const twoDigitYearCutoffLabel = localize('objectManagement.twoDigitYearCutoffLabel', "Two Digit Year Cutoff");
export const costThresholdParallelismLabel = localize('objectManagement.costThresholdParallelismLabel', "Cost Threshold Parallelism");
export const locksLabel = localize('objectManagement.locksLabel', "Locks");
export function locksValidation(minValue: number): string { return localize('objectManagement.locksValidation', "Value should be greater than {0}. Choose 0 for default settings.", minValue); }
export const maxDegreeParallelismLabel = localize('objectManagement.maxDegreeParallelismLabel', "Max Degree Parallelism");
export const queryWaitLabel = localize('objectManagement.queryWaitLabel', "Query Wait");

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
export const DatabaseScopedConfigurationTabHeader = localize('objectManagement.databaseProperties.databaseProperties.databaseScopedConfigurationTabHeader', "Database Scoped Configuration");
export const QueryStoreTabHeader = localize('objectManagement.databaseProperties.databaseProperties.queryStoreTabHeader', "Query Store");
export const DatabaseScopedOptionsColumnHeader = localize('objectManagement.databaseProperties.databaseScopedOptionsColumnHeader', "Database Scoped Options");
export const ValueForPrimaryColumnHeader = localize('objectManagement.databaseProperties.valueForPrimaryColumnHeader', "Value for Primary");
export const ValueForSecondaryColumnHeader = localize('objectManagement.databaseProperties.valueForSecondaryColumnHeader', "Value for Secondary");
export const SetSecondaryText = localize('objectManagement.databaseProperties.setSecondaryText', "Set Secondary same as Primary");
export const DatabaseNameText = localize('objectManagement.databaseProperties.databaseNameLabel', "Database Name");
export const UseFullTextIndexingText = localize('objectManagement.databaseProperties.useFullTextIndexingText', "Use full-text indexing");
export const LogicalNameText = localize('objectManagement.databaseProperties.logicalNameText', "Logical Name");
export const FileTypeText = localize('objectManagement.databaseProperties.fileTypeText', "File Type");
export const FilegroupText = localize('objectManagement.databaseProperties.filegroupText', "Filegroup");
export const AutogrowthMaxsizeText = localize('objectManagement.databaseProperties.autogrowthMaxsizeText', "Autogrowth / Maxsize");
export const PathText = localize('objectManagement.databaseProperties.pathText', "Path");
export const FileNameText = localize('objectManagement.databaseProperties.fileNameText', "File Name");
export const DatabaseFilesText = localize('objectManagement.databaseProperties.databaseFilesText', "Database files");
export const AddDatabaseFilesText = localize('objectManagement.databaseProperties.addDatabaseFilesText', "Add Database file");
export const EditDatabaseFilesText = (fileName: string) => localize('objectManagement.databaseProperties.editDatabaseFilesText', "Edit Database file - {0}", fileName);
export const AddButton = localize('objectManagement.databaseProperties.addButton', "Add");
export const EditButton = localize('objectManagement.databaseProperties.editButton', "Edit");
export const RemoveButton = localize('objectManagement.databaseProperties.removeButton', "Remove");
export const SizeInMbText = localize('objectManagement.databaseProperties.size', "Size (MB)");
export const EnableAutogrowthText = localize('objectManagement.databaseProperties.enableAutogrowthText', "Enable Autogrowth");
export const FileGrowthText = localize('objectManagement.databaseProperties.fileGrowthText', "File Growth");
export const MaximumFileSizeText = localize('objectManagement.databaseProperties.maximumFileSizeText', "Maximum File Size");
export const InPercentAutogrowthText = localize('objectManagement.databaseProperties.inPercentAutogrowthText', "In Percent");
export const InMegabytesAutogrowthText = localize('objectManagement.databaseProperties.inMegabytesAutogrowthText', "In Megabytes");
export const LimitedToMBFileSizeText = localize('objectManagement.databaseProperties.limitedToMBFileSizeText', "Limited to (MB)");
export const UnlimitedFileSizeText = localize('objectManagement.databaseProperties.unlimitedFileSizeText', "Unlimited");
export const NoneText = localize('objectManagement.databaseProperties.noneText', "None");
export function AutoGrowthValueStringGenerator(isFileGrowthSupported: boolean, fileGrowth: string, isFleGrowthInPercent: boolean, maxFileSize: number): string {
	const maxSizelimitation = maxFileSize === -1
		? localize('objectManagement.databaseProperties.autoGrowthValueConversion.unlimited', "Unlimited")
		: localize('objectManagement.databaseProperties.autoGrowthValueConversion.limitation', "Limited to {0} MB", maxFileSize);
	return isFileGrowthSupported ? localize('objectManagement.databaseProperties.autoGrowthValueConversion', "By {0} {1}, {2}", fileGrowth, isFleGrowthInPercent ? "Percent" : "MB", maxSizelimitation)
		: localize('objectManagement.databaseProperties.autoGrowthValueConversion', "{0}", maxSizelimitation);
}
export const FileGroupForLogTypeText = localize('objectManagement.databaseProperties.fileGroupNotApplicableText', "Not Applicable");
export const FileGroupForFilestreamTypeText = localize('objectManagement.databaseProperties.fileGroupNotApplicableText', "No Applicable Filegroup");
export const DuplicateLogicalNameError = (name: string) => localize('objectManagement.databaseProperties.fileGroupNotApplicableText', "DataFile '{0}' could not be added to the collection, because it already exists.", name);
export const FileNameExistsError = (name: string) => localize('objectManagement.databaseProperties.fileNameExistsError', "The Logical file name '{0}' is already in use. Choose a different name.", name);
export const FileAlreadyExistsError = (fullFilePath: string) => localize('objectManagement.databaseProperties.fileNameExistsError', "Cannot create file '{0}' because it already exists.", fullFilePath);
export const FileSizeLimitError = localize('objectManagement.databaseProperties.fileSizeLimitError', "Maximum file size cannot be less than size");
export const FilegrowthLimitError = localize('objectManagement.databaseProperties.filegrowthLimitError', "Filegrowth cannot be greater than the Maximum file size for a file");
export const RowsDataFileType = localize('objectManagement.databaseProperties.rowsDataFileType', "ROWS Data");
export const LogFiletype = localize('objectManagement.databaseProperties.logfiletype', "LOG");
export const FilestreamFileType = localize('objectManagement.databaseProperties.filestreamFileType', "FILESTREAM Data");
export const RowsFileGroupsSectionText = localize('objectManagement.databaseProperties.rowsFileGroupsSectionText', "Rows");
export const FileStreamFileGroupsSectionText = localize('objectManagement.databaseProperties.fileStreamFileGroupsSectionText', "FileStream");
export const MemoryOptimizedFileGroupsSectionText = localize('objectManagement.databaseProperties.memoryOptimizedFileGroupsSectionText', "Memory Optimized Data");
export const FilesText = localize('objectManagement.databaseProperties.filesText', "Files");
export const ReadOnlyText = localize('objectManagement.databaseProperties.readOnlyText', "Read-Only");
export const DefaultText = localize('objectManagement.databaseProperties.defaultText', "Default");
export const AutogrowAllFilesText = localize('objectManagement.databaseProperties.autogrowAllFilesText', "Autogrow All Files");
export const FilestreamFilesText = localize('objectManagement.databaseProperties.filestreamFilesText', "Filestream Files");
export const AddFilegroupText = localize('objectManagement.databaseProperties.addFilegroupButtonText', "Add Filegroup");
export const FilegroupExistsError = (name: string) => localize('objectManagement.databaseProperties.FilegroupExistsError', "File group '{0}' could not be added to the collection, because it already exists.", name);
export const EmptyFilegroupNameError = localize('objectManagement.databaseProperties.emptyFilegroupNameError', "Cannot use empty object names for filegroups.");
export const ActualOperationModeText = localize('objectManagement.databaseProperties.actualOperationModeText', "Operation Mode (Actual)");
export const RequestedOperationModeText = localize('objectManagement.databaseProperties.requestedOperationModeText', "Operation Mode (Requested)");
export const DataFlushIntervalInMinutesText = localize('objectManagement.databaseProperties.dataFlushIntervalInMinutesText', "Data Flush Interval (Minutes)");
export const StatisticsCollectionInterval = localize('objectManagement.databaseProperties.statisticsCollectionInterval', "Statistics Collection Interval");
export const MaxPlansPerQueryText = localize('objectManagement.databaseProperties.maxPlansPerQueryText', "Max Plans Per Query");
export const MaxSizeInMbText = localize('objectManagement.databaseProperties.maxSizeInMbText', "Max Size (MB)");
export const QueryStoreCaptureModeText = localize('objectManagement.databaseProperties.queryStoreCaptureModeText', "Query Store Capture Mode");
export const SizeBasedCleanupModeText = localize('objectManagement.databaseProperties.sizeBasedCleanupModeText', "Size Based Cleanup Mode");
export const StateQueryThresholdInDaysText = localize('objectManagement.databaseProperties.stateQueryThresholdInDaysText', "State Query Threshold (Days)");
export const WaitStatisticsCaptureModeText = localize('objectManagement.databaseProperties.waitStatisticsCaptureModeText', "Wait Statistics Capture Mode");
export const MonitoringSectionText = localize('objectManagement.databaseProperties.monitoringSectionText', "Monitoring");
export const QueryStoreRetentionSectionText = localize('objectManagement.databaseProperties.queryStoreRetentionSectionText', "Query Store Retention");
export const QueryStoreCapturePolicySectionText = localize('objectManagement.databaseProperties.queryStoreCapturePolicySectionText', "Query Store Capture Policy");
export const QueryStoreCurrentDiskUsageSectionText = localize('objectManagement.databaseProperties.queryStoreCurrentDiskUsageSectionText', "Current Disk Usage");
export const ExecutionCountText = localize('objectManagement.databaseProperties.executionCountText', "Execution Count");
export const StaleThresholdText = localize('objectManagement.databaseProperties.staleThresholdText', "Stale Threshold");
export const TotalCompileCPUTimeInMsText = localize('objectManagement.databaseProperties.totalCompileCPUTimeInMs', "Total Compile CPU Time (ms)");
export const TotalExecutionCPUTimeInMsText = localize('objectManagement.databaseProperties.totalExecutionCPUTimeInMsText', "Total Execution CPU Time (ms)");
export const QueryStoreCapturemodeCustomText = localize('objectManagement.databaseProperties.queryStoreCapturemodeCustomText', "Custom");
export const QueryStoreUsedText = localize('objectManagement.databaseProperties.queryStoreUsedText', "Query Store Used");
export const QueryStoreAvailableText = localize('objectManagement.databaseProperties.queryStoreAvailableText', "Query Store Available");
export const PurgeQueryDataButtonText = localize('objectManagement.databaseProperties.purgeQueryDataButtonText', "Purge Query Store Data");
export const YesText = localize('objectManagement.databaseProperties.yesText', "Yes");
export const NotAvailableText = localize('objectManagement.databaseProperties.notAvailableText', "N/A");
export const PurgeQueryStoreDataMessage = (databaseName: string) => localize('objectManagement.databaseProperties.purgeQueryStoreDataMessage', "Are you sure you want to purge the Query Store data from '{0}'?", databaseName);
export const fileGroupsNameInput = localize('objectManagement.filegroupsNameInput', "Filegroup Name");

// S3 credentials
export const SelectS3BackupFileDialogTitle = localize('objectManagement.selectS3BackupFileDialogTitle', "Select S3 Storage Backup File");
export const RegionSpecificEndpointText = localize('objectManagement.regionSpecificEndpointLabel', "Region-specific endpoint");
export const SecretKeyText = localize('objectManagement.secretKeyLabel', "Secret Key");
export const AccessKeyText = localize('objectManagement.accessKeyLabel', "Access Key");
export const RegionText = localize('objectManagement.regionLabel', "Region");
export const AddCredentialsText = localize('objectManagement.addCredentialsLabel', "Add Credentials");
export const SelectS3BucketText = localize('objectManagement.SelectS3BucketLabel', "Select S3 Bucket");
export const SelectBackupFileText = localize('objectManagement.SelectBackupFileLabel', "Select Backup File");
export const InvalidS3UrlError = localize('objectManagement.InvalidS3UrlError', "Invalid S3 endpoint");

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
