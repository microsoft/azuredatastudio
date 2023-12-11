/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagement } from 'mssql';

/**
 * Base interface for all the security principal objects. e.g. Login, Server Role, Database Role...
 */
export interface SecurityPrincipalObject extends ObjectManagement.SqlObject {
	securablePermissions: SecurablePermissions[];
}

/**
 * Securable type metadata.
 */
export interface SecurableTypeMetadata {
	/**
	 * Name of the securable type.
	 */
	name: string;
	/**
	 * Display name of the securable type.
	 */
	displayName: string;
	/**
	 * Permissions supported by the securable type.
	 */
	permissions: PermissionMetadata[];
}

/**
 * Permission metadata.
 */
export interface PermissionMetadata {
	/**
	 * Name of the permission.
	 */
	name: string;
	/**
	 * Display name of the permission.
	 */
	displayName: string;
}

/**
 * Base interface for security principal object's view information.
 */
export interface SecurityPrincipalViewInfo<T extends SecurityPrincipalObject> extends ObjectManagement.ObjectViewInfo<T> {
	/**
	 * The securable types that the security principal object can be granted permissions on.
	 */
	supportedSecurableTypes: SecurableTypeMetadata[];
}

/**
 * Base interface for database level security principal object's view information.
 */
export interface DatabaseLevelPrincipalViewInfo<T extends SecurityPrincipalObject> extends SecurityPrincipalViewInfo<T> {
	/**
	 * The schemas in the database.
	 */
	schemas: string[];
}

/**
 * Server level login.
 */
export interface Login extends SecurityPrincipalObject {
	/**
	 * Authentication type.
	 */
	authenticationType: AuthenticationType;
	/**
	 * Password for the login.
	 * Only applicable when the authentication type is 'Sql'.
	 */
	password: string | undefined;
	/**
	 * Old password of the login.
	 * Only applicable when the authentication type is 'Sql'.
	 * The old password is required when updating the login's own password and it doesn't have the 'ALTER ANY LOGIN' permission.
	 */
	oldPassword: string | undefined;
	/**
	 * Whether the password complexity policy is enforced.
	 * Only applicable when the authentication type is 'Sql'.
	 */
	enforcePasswordPolicy: boolean | undefined;
	/**
	 * Whether the password expiration policy is enforced.
	 * Only applicable when the authentication type is 'Sql'.
	 */
	enforcePasswordExpiration: boolean | undefined;
	/**
	 * Whether SQL Server should prompt for an updated password when the next the login is used.
	 * Only applicable when the authentication type is 'Sql'.
	 */
	mustChangePassword: boolean | undefined;
	/**
	 * Whether the login is locked out due to password policy violation.
	 * Only applicable when the authentication type is 'Sql'.
	 */
	isLockedOut: boolean;
	/**
	 * The default database for the login.
	 */
	defaultDatabase: string;
	/**
	 * The default language for the login.
	 */
	defaultLanguage: string;
	/**
	 * The server roles of the login.
	 */
	serverRoles: string[];
	/**
	 * The database users the login is mapped to.
	 */
	userMapping: ServerLoginUserInfo[];
	/**
	 * Whether the login is enabled.
	 */
	isEnabled: boolean;
	/**
	 * Whether the connect permission is granted to the login.
	 */
	connectPermission: boolean;
}

/**
 * The authentication types.
 */
export const enum AuthenticationType {
	Windows = 'Windows',
	Sql = 'Sql',
	AzureActiveDirectory = 'AAD'
}

/**
 * The user mapping information for login.
 */
export interface ServerLoginUserInfo {
	/**
	 * Target database name.
	 */
	database: string;
	/**
	 * User name.
	 */
	user: string;
	/**
	 * Default schema of the user.
	 */
	defaultSchema: string;
	/**
	 * Databases roles of the user.
	 */
	databaseRoles: string[];
}

/**
 * The information required to render the login view.
 */
export interface LoginViewInfo extends SecurityPrincipalViewInfo<Login> {
	/**
	 * The authentication types supported by the server.
	 */
	authenticationTypes: AuthenticationType[];
	/**
	 * Whether the locked out state can be changed.
	 */
	canEditLockedOutState: boolean;
	/**
	 * Name of the databases in the server.
	 */
	databases: string[];
	/**
	 * Available languages in the server.
	 */
	languages: string[];
	/**
	 * All server roles in the server.
	 */
	serverRoles: string[];
	/**
	 * Whether advanced password options are supported.
	 * Advanced password options: check policy, check expiration, must change, unlock.
	 * Notes: 2 options to control the advanced options because Analytics Platform supports advanced options but does not support advanced options.
	 */
	supportAdvancedPasswordOptions: boolean;
	/**
	 * Whether advanced options are supported.
	 * Advanced options: default database, default language and connect permission.
	 */
	supportAdvancedOptions: boolean;
}

/**
 * The permission information a principal has on a securable.
 */
export interface SecurablePermissionItem {
	/**
	 * name of the permission.
	 */
	permission: string;
	/**
	 * Name of the grantor.
	 */
	grantor: string;
	/**
	 * Whether the permission is granted or denied. Undefined means not specified.
	 */
	grant?: boolean;
	/**
	 * Whether the pincipal can grant this permission to other principals.
	 * The value will be ignored if the grant property is set to false.
	 */
	withGrant?: boolean;
}

/**
 * The permissions a principal has over a securable.
 */
export interface SecurablePermissions {
	/**
	 * The securable name.
	 */
	name: string;
	/**
	 * The securable type.
	 */
	type: string;
	/**
	 * The schema name of the object if applicable.
	 */
	schema?: string;
	/**
	 * The permissions.
	 */
	permissions: SecurablePermissionItem[];
	/**
	 * The effective permissions. Includes all permissions granted to the principal, including those granted through role memberships.
	 */
	effectivePermissions: string[];
}

/**
 * Extend property for objects.
 */
export interface ExtendedProperty {
	/**
	 * Name of the property.
	 */
	name: string;
	/**
	 * Value of the property.
	 */
	value: string;
}

/**
 * User types.
 */
export const enum UserType {
	/**
	 * Mapped to a server login.
	 */
	LoginMapped = 'LoginMapped',
	/**
	 * Mapped to a Windows user or group.
	 */
	WindowsUser = 'WindowsUser',
	/**
	 * Authenticate with password.
	 */
	SqlAuthentication = 'SqlAuthentication',
	/**
	 * Authenticate with Microsoft Entra.
	 */
	AADAuthentication = 'AADAuthentication',
	/**
	 * User that cannot authenticate.
	 */
	NoLoginAccess = 'NoLoginAccess'
}

/**
 * Database user.
 */
export interface User extends SecurityPrincipalObject {
	/**
	 * Type of the user.
	 */
	type: UserType;
	/**
	 * Default schema of the user.
	 */
	defaultSchema: string | undefined;
	/**
	 * Schemas owned by the user.
	 */
	ownedSchemas: string[];
	/**
	 * Database roles that the user belongs to.
	 */
	databaseRoles: string[];
	/**
	 * The name of the server login associated with the user.
	 * Only applicable when the user type is 'WithLogin'.
	 */
	loginName: string | undefined;
	/**
	 * The default language of the user.
	 * Only applicable when the user type is 'Contained'.
	 */
	defaultLanguage: string | undefined;
	/**
	 * Password of the user.
	 * Only applicable when the user type is 'Contained' and the authentication type is 'Sql'.
	 */
	password: string | undefined;
}

/**
 * The information required to render the user view.
 */
export interface UserViewInfo extends DatabaseLevelPrincipalViewInfo<User> {
	/**
	 * All user types supported by the database.
	 */
	userTypes: UserType[];
	/**
	 * All languages supported by the database.
	 */
	languages: string[];
	/**
	 * Name of all the logins in the server.
	 */
	logins: string[];
	/**
	 * Name of all the database roles.
	 */
	databaseRoles: string[];
}

/**
 * Interface representing the server role object.
 */
export interface ServerRoleInfo extends SecurityPrincipalObject {
	/**
	 * Name of the server principal that owns the server role.
	 */
	owner: string;
	/**
	 * Name of the server principals that are members of the server role.
	 */
	members: string[];
	/**
	 * Server roles that the server role is a member of.
	 */
	memberships: string[];
}

/**
 * Interface representing the information required to render the server role view.
 */
export interface ServerRoleViewInfo extends SecurityPrincipalViewInfo<ServerRoleInfo> {
	/**
	 * Whether the server role is a fixed role.
	 */
	isFixedRole: boolean;
	/**
	 * List of all the server roles.
	 */
	serverRoles: string[];
}

/**
 * Interface representing the application role object.
 */
export interface ApplicationRoleInfo extends SecurityPrincipalObject {
	/**
	 * Default schema of the application role.
	 */
	defaultSchema: string;
	/**
	 * Schemas owned by the application role.
	 */
	ownedSchemas: string[];
	/**
	 * Password of the application role.
	 */
	password: string;
}

/**
 * Interface representing the information required to render the application role view.
 */
export interface ApplicationRoleViewInfo extends DatabaseLevelPrincipalViewInfo<ApplicationRoleInfo> {
}

/**
 * Interface representing the database role object.
 */
export interface DatabaseRoleInfo extends SecurityPrincipalObject {
	/**
	 * Name of the database principal that owns the database role.
	 */
	owner: string;
	/**
	 * Schemas owned by the database role.
	 */
	ownedSchemas: string[];
	/**
	 * Name of the user or database role that are members of the database role.
	 */
	members: string[];
}

/**
 * Interface representing the information required to render the database role view.
 */
export interface DatabaseRoleViewInfo extends DatabaseLevelPrincipalViewInfo<DatabaseRoleInfo> {
}

export interface Database extends ObjectManagement.SqlObject {
	owner?: string;
	collationName?: string;
	recoveryModel?: string;
	compatibilityLevel?: string;
	containmentType?: string;
	dateCreated?: string;
	lastDatabaseBackup?: string;
	lastDatabaseLogBackup?: string;
	memoryAllocatedToMemoryOptimizedObjectsInMb?: number;
	memoryUsedByMemoryOptimizedObjectsInMb?: number;
	numberOfUsers?: number;
	sizeInMb?: number;
	spaceAvailableInMb?: number;
	status?: string;
	azureBackupRedundancyLevel?: string;
	azureServiceLevelObjective?: string;
	azureEdition?: string;
	azureMaxSize?: string;
	autoCreateIncrementalStatistics: boolean;
	autoCreateStatistics: boolean;
	autoShrink: boolean;
	autoUpdateStatistics: boolean;
	autoUpdateStatisticsAsynchronously: boolean;
	isLedgerDatabase?: boolean;
	pageVerify?: string;
	targetRecoveryTimeInSec?: number;
	databaseReadOnly?: boolean;
	encryptionEnabled: boolean;
	restrictAccess?: string;
	databaseScopedConfigurations: DatabaseScopedConfigurationsInfo[];
	isFilesTabSupported?: boolean;
	files?: DatabaseFile[];
	filegroups?: FileGroup[];
	queryStoreOptions?: QueryStoreOptions;
	restorePlanResponse?: azdata.RestorePlanResponse;
	backupEncryptors?: BackupEncryptor[];
}

export interface DatabaseViewInfo extends ObjectManagement.ObjectViewInfo<Database> {
	isAzureDB: boolean;
	isManagedInstance: boolean;
	isSqlOnDemand: boolean;
	loginNames?: OptionsCollection;
	collationNames?: OptionsCollection;
	compatibilityLevels?: OptionsCollection;
	containmentTypes?: OptionsCollection;
	recoveryModels?: OptionsCollection;
	azureBackupRedundancyLevels?: string[];
	azureServiceLevelObjectives?: AzureEditionDetails[];
	azureEditions?: string[];
	azureMaxSizes?: AzureEditionDetails[];
	pageVerifyOptions?: string[];
	restrictAccessOptions?: string[];
	propertiesOnOffOptions?: string[];
	dscElevateOptions?: string[];
	dscEnableDisableOptions?: string[];
	rowDataFileGroupsOptions?: string[];
	fileStreamFileGroupsOptions?: string[];
	fileTypesOptions?: string[];
	operationModeOptions?: string[];
	statisticsCollectionIntervalOptions?: string[];
	queryStoreCaptureModeOptions?: string[];
	sizeBasedCleanupModeOptions?: string[];
	staleThresholdOptions?: string[];
	serverFilestreamAccessLevel?: FileStreamEffectiveLevel;
	restoreDatabaseInfo?: RestoreDatabaseInfo;
}

export interface QueryStoreOptions {
	actualMode: string;
	dataFlushIntervalInMinutes: number;
	statisticsCollectionInterval: string;
	maxPlansPerQuery: number;
	maxSizeInMB: number;
	queryStoreCaptureMode: string;
	sizeBasedCleanupMode: string;
	staleQueryThresholdInDays: number;
	waitStatisticsCaptureMode?: string;
	capturePolicyOptions?: QueryStoreCapturePolicyOptions;
	currentStorageSizeInMB: number;
}

export interface RestoreDatabaseInfo {
	sourceDatabaseNames: string[];
	targetDatabaseNames: string[];
	recoveryStateOptions: CategoryValue[];
}

export interface CategoryValue {
	displayName: string;
	name: string;
}

export interface QueryStoreCapturePolicyOptions {
	executionCount: number;
	staleThreshold: string;
	totalCompileCPUTimeInMS: number;
	totalExecutionCPUTimeInMS: number;
}

export interface BackupEncryptor {
	encryptorType: number;
	encryptorName: string;
}

export interface DatabaseScopedConfigurationsInfo {
	id: number;
	name: string;
	valueForPrimary: string;
	valueForSecondary: string;
}

export interface OptionsCollection {
	options: string[];
	defaultValueIndex: number;
}

export interface AzureEditionDetails {
	editionDisplayName: string;
	editionOptions: OptionsCollection;
}

export interface ProcessorAffinity {
	processorId: string;
	affinity: boolean;
	ioAffinity: boolean;
}

export interface NumaNode {
	numaNodeId: string
	processors: ProcessorAffinity[]
}

export enum AffinityType {
	ProcessorAffinity = 1,
	IOAffinity = 2,
}

export interface Server extends ObjectManagement.SqlObject {
	hardwareGeneration?: string;
	language: string;
	memoryInMB: number;
	operatingSystem: string;
	platform: string;
	processors: string;
	version: string;
	isClustered: boolean;
	isHadrEnabled: boolean;
	isPolyBaseInstalled?: boolean;
	isXTPSupported?: boolean;
	product: string;
	reservedStorageSizeMB?: number;
	rootDirectory: string;
	serverCollation: string;
	serviceTier?: string;
	storageSpaceUsageInMB?: number;
	minServerMemory: NumericServerProperty;
	maxServerMemory: NumericServerProperty;
	autoProcessorAffinityMaskForAll: boolean;
	autoProcessorAffinityIOMaskForAll: boolean;
	numaNodes: NumaNode[];
	authenticationMode: ServerLoginMode;
	loginAuditing: AuditLevel;
	checkCompressBackup: boolean;
	checkBackupChecksum: boolean;
	dataLocation: string;
	logLocation: string;
	backupLocation: string;
	allowTriggerToFireOthers: boolean;
	blockedProcThreshold: NumericServerProperty;
	cursorThreshold: NumericServerProperty;
	defaultFullTextLanguage: string;
	defaultLanguage: string;
	fullTextUpgradeOption: string;
	maxTextReplicationSize: NumericServerProperty;
	optimizeAdHocWorkloads: boolean;
	scanStartupProcs: boolean;
	twoDigitYearCutoff: number;
	costThresholdParallelism: NumericServerProperty;
	locks: NumericServerProperty;
	maxDegreeParallelism: NumericServerProperty;
	queryWait: NumericServerProperty;
}

/**
 * The server login types.
 */
export const enum ServerLoginMode {
	Integrated = 1, //windows auth only
	Mixed = 2// both sql server and windows auth
}

/**
 * The server audit levels.
 */
export const enum AuditLevel {
	None,
	Success,
	Failure,
	All
}

export interface NumericServerProperty {
	maximumValue: number;
	minimumValue: number;
	value: number;
}

export interface ServerViewInfo extends ObjectManagement.ObjectViewInfo<Server> {
	languageOptions: string[];
	fullTextUpgradeOptions: string[];
}

export const enum FileGrowthType {
	KB = 0,
	Percent = 1,
	None = 99
}

export const enum FileGroupType {
	RowsFileGroup = 0,
	FileStreamDataFileGroup = 2,
	MemoryOptimizedDataFileGroup = 3
}

export const enum FileStreamEffectiveLevel {
	Disabled = 0,
	TSqlAccess,
	TSqlLocalFileSystemAccess,
	TSqlFullFileSystemAccess
}

export interface DatabaseFile {
	id: number;
	name: string;
	type: string;
	path: string;
	fileGroup: string;
	fileNameWithExtension: string;
	sizeInMb: number;
	isAutoGrowthEnabled: boolean;
	autoFileGrowth: number;
	autoFileGrowthType: FileGrowthType;
	maxSizeLimitInMb: number
}

export interface FileGroup {
	id?: number;
	name: string;
	type: FileGroupType;
	isReadOnly: boolean;
	isDefault: boolean;
	autogrowAllFiles: boolean;
}
