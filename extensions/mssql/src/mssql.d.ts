/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for extensions to expose APIs.

import * as azdata from 'azdata';
import * as vscode from 'vscode';

/**
 * Covers defining what the mssql extension exports to other extensions
 *
 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
 * (const enums get evaluated when typescript -> javascript so those are fine)
 */


export const enum extension {
	name = 'Microsoft.mssql'
}

/**
* The APIs provided by Mssql extension
*/
export interface IExtension {
	/**
	 * Gets the object explorer API that supports querying over the connections supported by this extension
	 *
	 */
	getMssqlObjectExplorerBrowser(): MssqlObjectExplorerBrowser;

	/**
	 * Get the Cms Service APIs to communicate with CMS connections supported by this extension
	 *
	 */
	readonly cmsService: ICmsService;

	readonly schemaCompare: ISchemaCompareService;

	readonly languageExtension: ILanguageExtensionService;

	readonly dacFx: IDacFxService;

	readonly sqlAssessment: ISqlAssessmentService;
}

/**
 * A browser supporting actions over the object explorer connections provided by this extension.
 * Currently this is the
 */
export interface MssqlObjectExplorerBrowser {
	/**
	 * Gets the matching node given a context object, e.g. one from a right-click on a node in Object Explorer
	 */
	getNode<T extends ITreeNode>(objectExplorerContext: azdata.ObjectExplorerContext): Thenable<T>;
}

/**
 * A tree node in the object explorer tree
 */
export interface ITreeNode {
	getNodeInfo(): azdata.NodeInfo;
	getChildren(refreshChildren: boolean): ITreeNode[] | Thenable<ITreeNode[]>;
}

/**
 * A HDFS file node. This is a leaf node in the object explorer tree, and its contents
 * can be queried
 */
export interface IFileNode extends ITreeNode {
	getFileContentsAsString(maxBytes?: number): Thenable<string>;
}

//#region --- schema compare
export interface SchemaCompareResult extends azdata.ResultStatus {
	operationId: string;
	areEqual: boolean;
	differences: DiffEntry[];
}

export interface SchemaCompareIncludeExcludeResult extends azdata.ResultStatus {
	affectedDependencies: DiffEntry[];
	blockingDependencies: DiffEntry[];
}

export interface SchemaCompareCompletionResult extends azdata.ResultStatus {
	operationId: string;
	areEqual: boolean;
	differences: DiffEntry[];
}

export interface DiffEntry {
	updateAction: SchemaUpdateAction;
	differenceType: SchemaDifferenceType;
	name: string;
	sourceValue: string[];
	targetValue: string[];
	parent: DiffEntry;
	children: DiffEntry[];
	sourceScript: string;
	targetScript: string;
	included: boolean;
}

export const enum SchemaUpdateAction {
	Delete = 0,
	Change = 1,
	Add = 2
}

export const enum SchemaDifferenceType {
	Object = 0,
	Property = 1
}

export const enum SchemaCompareEndpointType {
	Database = 0,
	Dacpac = 1
}

export interface SchemaCompareEndpointInfo {
	endpointType: SchemaCompareEndpointType;
	packageFilePath: string;
	serverDisplayName: string;
	serverName: string;
	databaseName: string;
	ownerUri: string;
	connectionDetails: azdata.ConnectionInfo;
}

export interface SchemaCompareObjectId {
	nameParts: string[];
	sqlObjectType: string;
}

export interface SchemaCompareOptionsResult extends azdata.ResultStatus {
	defaultDeploymentOptions: DeploymentOptions;
}

export interface DeploymentOptions {
	ignoreTableOptions: boolean;
	ignoreSemicolonBetweenStatements: boolean;
	ignoreRouteLifetime: boolean;
	ignoreRoleMembership: boolean;
	ignoreQuotedIdentifiers: boolean;
	ignorePermissions: boolean;
	ignorePartitionSchemes: boolean;
	ignoreObjectPlacementOnPartitionScheme: boolean;
	ignoreNotForReplication: boolean;
	ignoreLoginSids: boolean;
	ignoreLockHintsOnIndexes: boolean;
	ignoreKeywordCasing: boolean;
	ignoreIndexPadding: boolean;
	ignoreIndexOptions: boolean;
	ignoreIncrement: boolean;
	ignoreIdentitySeed: boolean;
	ignoreUserSettingsObjects: boolean;
	ignoreFullTextCatalogFilePath: boolean;
	ignoreWhitespace: boolean;
	ignoreWithNocheckOnForeignKeys: boolean;
	verifyCollationCompatibility: boolean;
	unmodifiableObjectWarnings: boolean;
	treatVerificationErrorsAsWarnings: boolean;
	scriptRefreshModule: boolean;
	scriptNewConstraintValidation: boolean;
	scriptFileSize: boolean;
	scriptDeployStateChecks: boolean;
	scriptDatabaseOptions: boolean;
	scriptDatabaseCompatibility: boolean;
	scriptDatabaseCollation: boolean;
	runDeploymentPlanExecutors: boolean;
	registerDataTierApplication: boolean;
	populateFilesOnFileGroups: boolean;
	noAlterStatementsToChangeClrTypes: boolean;
	includeTransactionalScripts: boolean;
	includeCompositeObjects: boolean;
	allowUnsafeRowLevelSecurityDataMovement: boolean;
	ignoreWithNocheckOnCheckConstraints: boolean;
	ignoreFillFactor: boolean;
	ignoreFileSize: boolean;
	ignoreFilegroupPlacement: boolean;
	doNotAlterReplicatedObjects: boolean;
	doNotAlterChangeDataCaptureObjects: boolean;
	disableAndReenableDdlTriggers: boolean;
	deployDatabaseInSingleUserMode: boolean;
	createNewDatabase: boolean;
	compareUsingTargetCollation: boolean;
	commentOutSetVarDeclarations: boolean;
	blockWhenDriftDetected: boolean;
	blockOnPossibleDataLoss: boolean;
	backupDatabaseBeforeChanges: boolean;
	allowIncompatiblePlatform: boolean;
	allowDropBlockingAssemblies: boolean;
	dropConstraintsNotInSource: boolean;
	dropDmlTriggersNotInSource: boolean;
	dropExtendedPropertiesNotInSource: boolean;
	dropIndexesNotInSource: boolean;
	ignoreFileAndLogFilePath: boolean;
	ignoreExtendedProperties: boolean;
	ignoreDmlTriggerState: boolean;
	ignoreDmlTriggerOrder: boolean;
	ignoreDefaultSchema: boolean;
	ignoreDdlTriggerState: boolean;
	ignoreDdlTriggerOrder: boolean;
	ignoreCryptographicProviderFilePath: boolean;
	verifyDeployment: boolean;
	ignoreComments: boolean;
	ignoreColumnCollation: boolean;
	ignoreAuthorizer: boolean;
	ignoreAnsiNulls: boolean;
	generateSmartDefaults: boolean;
	dropStatisticsNotInSource: boolean;
	dropRoleMembersNotInSource: boolean;
	dropPermissionsNotInSource: boolean;
	dropObjectsNotInSource: boolean;
	ignoreColumnOrder: boolean;
	doNotDropObjectTypes: SchemaObjectType[];
	excludeObjectTypes: SchemaObjectType[];
}

export const enum SchemaObjectType {
	Aggregates = 0,
	ApplicationRoles = 1,
	Assemblies = 2,
	AssemblyFiles = 3,
	AsymmetricKeys = 4,
	BrokerPriorities = 5,
	Certificates = 6,
	ColumnEncryptionKeys = 7,
	ColumnMasterKeys = 8,
	Contracts = 9,
	DatabaseOptions = 10,
	DatabaseRoles = 11,
	DatabaseTriggers = 12,
	Defaults = 13,
	ExtendedProperties = 14,
	ExternalDataSources = 15,
	ExternalFileFormats = 16,
	ExternalTables = 17,
	Filegroups = 18,
	Files = 19,
	FileTables = 20,
	FullTextCatalogs = 21,
	FullTextStoplists = 22,
	MessageTypes = 23,
	PartitionFunctions = 24,
	PartitionSchemes = 25,
	Permissions = 26,
	Queues = 27,
	RemoteServiceBindings = 28,
	RoleMembership = 29,
	Rules = 30,
	ScalarValuedFunctions = 31,
	SearchPropertyLists = 32,
	SecurityPolicies = 33,
	Sequences = 34,
	Services = 35,
	Signatures = 36,
	StoredProcedures = 37,
	SymmetricKeys = 38,
	Synonyms = 39,
	Tables = 40,
	TableValuedFunctions = 41,
	UserDefinedDataTypes = 42,
	UserDefinedTableTypes = 43,
	ClrUserDefinedTypes = 44,
	Users = 45,
	Views = 46,
	XmlSchemaCollections = 47,
	Audits = 48,
	Credentials = 49,
	CryptographicProviders = 50,
	DatabaseAuditSpecifications = 51,
	DatabaseEncryptionKeys = 52,
	DatabaseScopedCredentials = 53,
	Endpoints = 54,
	ErrorMessages = 55,
	EventNotifications = 56,
	EventSessions = 57,
	LinkedServerLogins = 58,
	LinkedServers = 59,
	Logins = 60,
	MasterKeys = 61,
	Routes = 62,
	ServerAuditSpecifications = 63,
	ServerRoleMembership = 64,
	ServerRoles = 65,
	ServerTriggers = 66
}

export interface SchemaCompareObjectId {
	nameParts: string[];
	sqlObjectType: string;
}

export interface ISchemaCompareService {

	schemaCompare(operationId: string, sourceEndpointInfo: SchemaCompareEndpointInfo, targetEndpointInfo: SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: DeploymentOptions): Thenable<SchemaCompareResult>;
	schemaCompareGenerateScript(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus>;
	schemaComparePublishChanges(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus>;
	schemaCompareGetDefaultOptions(): Thenable<SchemaCompareOptionsResult>;
	schemaCompareIncludeExcludeNode(operationId: string, diffEntry: DiffEntry, IncludeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Thenable<SchemaCompareIncludeExcludeResult>;
	schemaCompareOpenScmp(filePath: string): Thenable<SchemaCompareOpenScmpResult>;
	schemaCompareSaveScmp(sourceEndpointInfo: SchemaCompareEndpointInfo, targetEndpointInfo: SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: DeploymentOptions, scmpFilePath: string, excludedSourceObjects: SchemaCompareObjectId[], excludedTargetObjects: SchemaCompareObjectId[]): Thenable<azdata.ResultStatus>;
	schemaCompareCancel(operationId: string): Thenable<azdata.ResultStatus>;
}

export interface SchemaCompareOpenScmpResult extends azdata.ResultStatus {
	sourceEndpointInfo: SchemaCompareEndpointInfo;
	targetEndpointInfo: SchemaCompareEndpointInfo;
	originalTargetName: string;
	originalConnectionString: string;
	deploymentOptions: DeploymentOptions;
	excludedSourceElements: SchemaCompareObjectId[];
	excludedTargetElements: SchemaCompareObjectId[];
}

//#endregion

//#region --- dacfx
export const enum ExtractTarget {
	dacpac = 0,
	file = 1,
	flat = 2,
	objectType = 3,
	schema = 4,
	schemaObjectType = 5
}

export interface IDacFxService {
	exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
	importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
	extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
	importDatabaseProject(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Thenable<DacFxResult>;
	deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
	generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
	generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
	getOptionsFromProfile(profilePath: string): Thenable<DacFxOptionsResult>;
}

export interface DacFxResult extends azdata.ResultStatus {
	operationId: string;
}

export interface GenerateDeployPlanResult extends DacFxResult {
	report: string;
}

export interface DacFxOptionsResult extends azdata.ResultStatus {
	deploymentOptions: DeploymentOptions;
}

export interface ExportParams {
	databaseName: string;
	packageFilePath: string;
	ownerUri: string;
	taskExecutionMode: azdata.TaskExecutionMode;
}

export interface ImportParams {
	packageFilePath: string;
	databaseName: string;
	ownerUri: string;
	taskExecutionMode: azdata.TaskExecutionMode;
}

export interface ExtractParams {
	databaseName: string;
	packageFilePath: string;
	applicationName: string;
	applicationVersion: string;
	ownerUri: string;
	extractTarget?: ExtractTarget;
	taskExecutionMode: azdata.TaskExecutionMode;
}

export interface DeployParams {
	packageFilePath: string;
	databaseName: string;
	upgradeExisting: boolean;
	ownerUri: string;
	taskExecutionMode: azdata.TaskExecutionMode;
}

export interface GenerateDeployScriptParams {
	packageFilePath: string;
	databaseName: string;
	ownerUri: string;
	taskExecutionMode: azdata.TaskExecutionMode;
}

export interface GenerateDeployPlan {
	packageFilePath: string;
	databaseName: string;
	ownerUri: string;
	taskExecutionMode: azdata.TaskExecutionMode;
}

//#endregion

//#region --- Language Extensibility
export interface ExternalLanguageContent {
	pathToExtension: string;
	extensionFileName: string;
	platform?: string;
	parameters?: string;
	environmentVariables?: string;
	isLocalFile: boolean;
}

export interface ExternalLanguage {
	name: string;
	owner?: string;
	contents: ExternalLanguageContent[];
	createdDate?: string;
}

export interface ILanguageExtensionService {
	listLanguages(ownerUri: string): Thenable<ExternalLanguage[]>;
	deleteLanguage(ownerUri: string, languageName: string): Thenable<void>;
	updateLanguage(ownerUri: string, language: ExternalLanguage): Thenable<void>;
}
//#endregion

//#region --- cms
/**
 *
 * Interface containing all CMS related operations
 */
export interface ICmsService {
	/**
	 * Connects to or creates a Central management Server
	 */
	createCmsServer(name: string, description:string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Thenable<ListRegisteredServersResult>;

	/**
	 * gets all Registered Servers inside a CMS on a particular level
	 */
	getRegisteredServers(ownerUri: string, relativePath: string): Thenable<ListRegisteredServersResult>;

	/**
	 * Adds a Registered Server inside a CMS on a particular level
	 */
	addRegisteredServer (ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription:string, connectionDetails:azdata.ConnectionInfo): Thenable<boolean>;

	/**
	 * Removes a Registered Server inside a CMS on a particular level
	 */
	removeRegisteredServer (ownerUri: string, relativePath: string, registeredServerName: string): Thenable<boolean>;

	/**
	 * Adds a Server Group inside a CMS on a particular level
	 */
	addServerGroup (ownerUri: string, relativePath: string, groupName: string, groupDescription:string): Thenable<boolean>;

	/**
	 * Removes a Server Group inside a CMS on a particular level
	 */
	removeServerGroup (ownerUri: string, relativePath: string, groupName: string): Thenable<boolean>;
}
/**
 * CMS Result interfaces as passed back to Extensions
 */
export interface RegisteredServerResult {
	name: string;
	serverName: string;
	description: string;
	connectionDetails: azdata.ConnectionInfo;
	relativePath: string;
}

export interface RegisteredServerGroup {
	name: string;
	description: string;
	relativePath: string;
}

export interface ListRegisteredServersResult {
	registeredServersList: Array<RegisteredServerResult>;
	registeredServerGroups: Array<RegisteredServerGroup>;
}
//#endregion

/**
 * Sql Assessment
 */

// SqlAssessment interfaces  -----------------------------------------------------------------------



export interface ISqlAssessmentService {
	assessmentInvoke(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult>;
	getAssessmentItems(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult>;
	generateAssessmentScript(items: azdata.SqlAssessmentResultItem[], targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus>;
}
