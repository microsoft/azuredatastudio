/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for extensions to expose APIs.
declare module 'mssql' {
	import * as azdata from 'azdata';

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
		 * Path to the root of the SQL Tools Service folder
		 */
		readonly sqlToolsServicePath: string;

		/**
		 * Get the Cms Service APIs to communicate with CMS connections supported by this extension
		 *
		 */
		readonly cmsService: ICmsService;

		readonly schemaCompare: ISchemaCompareService;

		readonly languageExtension: ILanguageExtensionService;

		readonly dacFx: IDacFxService;

		readonly sqlProjects: ISqlProjectsService;

		readonly sqlAssessment: ISqlAssessmentService;

		readonly sqlMigration: ISqlMigrationService;

		readonly azureBlob: IAzureBlobService;

		readonly tdeMigration: ITdeMigrationService;
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
		Dacpac = 1,
		Project = 2,
		// must be kept in-sync with SchemaCompareEndpointType in SQL Tools Service
		// located at \src\Microsoft.SqlTools.ServiceLayer\SchemaCompare\Contracts\SchemaCompareRequest.cs
	}

	export interface SchemaCompareEndpointInfo {
		endpointType: SchemaCompareEndpointType;
		packageFilePath: string;
		serverDisplayName: string;
		serverName: string;
		databaseName: string;
		ownerUri: string;
		connectionDetails: azdata.ConnectionInfo;
		connectionName?: string;
		projectFilePath: string;
		targetScripts: string[];
		folderStructure: ExtractTarget;
		dataSchemaProvider: string;
	}

	export interface SchemaCompareObjectId {
		nameParts: string[];
		sqlObjectType: string;
	}

	export interface SchemaCompareOptionsResult extends azdata.ResultStatus {
		defaultDeploymentOptions: DeploymentOptions;
	}

	/**
	* Interface containing deployment options of boolean type
	*/
	export interface DacDeployOptionPropertyBoolean {
		value: boolean;
		description: string;
		displayName: string;
	}

	/**
	* Interface containing deployment options of string[] type, value property holds enum names (nothing but option name) from <DacFx>\Product\Source\DeploymentApi\ObjectTypes.cs enum
	*/
	export interface DacDeployOptionPropertyObject {
		value: string[];
		description: string;
		displayName: string;
	}

	/*
	* Interface containing Deployment options from <DacFx>\Source\DeploymentApi\DacDeployOptions.cs
	* These property names should match with the properties defined in <sqltoolsservice>\src\Microsoft.SqlTools.ServiceLayer\DacFx\Contracts\DeploymentOptions.cs
	*/
	export interface DeploymentOptions {
		excludeObjectTypes: DacDeployOptionPropertyObject;
		// key will be the boolean option name
		booleanOptionsDictionary: { [key: string]: DacDeployOptionPropertyBoolean };
		// key will be the object type enum name (nothing but option name)
		objectTypesDictionary: { [key: string]: string };
	}

	/*
	* Interface containing option value and option name
	*/
	export interface IOptionWithValue {
		optionName: string;
		checked: boolean;
	}

	export interface SchemaCompareObjectId {
		nameParts: string[];
		sqlObjectType: string;
	}

	export interface ISchemaCompareService {
		schemaCompare(operationId: string, sourceEndpointInfo: SchemaCompareEndpointInfo, targetEndpointInfo: SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: DeploymentOptions): Thenable<SchemaCompareResult>;
		schemaCompareGenerateScript(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus>;
		schemaComparePublishDatabaseChanges(operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus>;
		schemaComparePublishProjectChanges(operationId: string, targetProjectPath: string, targetFolderStructure: ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode): Thenable<SchemaComparePublishProjectResult>;
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

	export interface SchemaComparePublishProjectResult extends azdata.ResultStatus {
		changedFiles: string[];
		addedFiles: string[];
		deletedFiles: string[];
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
		createProjectFromDatabase(databaseName: string, targetFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, extractTarget: ExtractTarget, taskExecutionMode: azdata.TaskExecutionMode, includePermissions?: boolean): Thenable<DacFxResult>;
		deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployScript(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<DacFxResult>;
		generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<GenerateDeployPlanResult>;
		getOptionsFromProfile(profilePath: string): Thenable<DacFxOptionsResult>;
		validateStreamingJob(packageFilePath: string, createStreamingJobTsql: string): Thenable<ValidateStreamingJobResult>;
		parseTSqlScript(filePath: string, databaseSchemaProvider: string): Thenable<ParseTSqlScriptResult>;
		savePublishProfile(profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Record<string, string>, deploymentOptions?: DeploymentOptions): Thenable<azdata.ResultStatus>;
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

	export interface ValidateStreamingJobResult extends azdata.ResultStatus {
	}

	export interface ParseTSqlScriptResult {
		containsCreateTableStatement: boolean;
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

	//#region --- Sql Projects

	export interface ISqlProjectsService {
		openProject(projectUri: string): Promise<azdata.ResultStatus>;
		getCrossPlatformCompatiblityRequest(projectUri: string): Promise<GetCrossPlatformCompatiblityResult>;
	}

	export interface GetCrossPlatformCompatiblityResult extends azdata.ResultStatus {
		isCrossPlatformCompatible: boolean;
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
		createCmsServer(name: string, description: string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Thenable<ListRegisteredServersResult>;

		/**
		 * gets all Registered Servers inside a CMS on a particular level
		 */
		getRegisteredServers(ownerUri: string, relativePath: string): Thenable<ListRegisteredServersResult>;

		/**
		 * Adds a Registered Server inside a CMS on a particular level
		 */
		addRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription: string, connectionDetails: azdata.ConnectionInfo): Thenable<boolean>;

		/**
		 * Removes a Registered Server inside a CMS on a particular level
		 */
		removeRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string): Thenable<boolean>;

		/**
		 * Adds a Server Group inside a CMS on a particular level
		 */
		addServerGroup(ownerUri: string, relativePath: string, groupName: string, groupDescription: string): Thenable<boolean>;

		/**
		 * Removes a Server Group inside a CMS on a particular level
		 */
		removeServerGroup(ownerUri: string, relativePath: string, groupName: string): Thenable<boolean>;
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


	/**
	 * Sql Migration
	 */

	// SKU recommendation interfaces, mirrored from Microsoft.SqlServer.Migration.SkuRecommendation
	export interface AzureSqlSkuCategory {
		sqlTargetPlatform: AzureSqlTargetPlatform;
		computeTier: ComputeTier;
	}

	export interface AzureSqlSkuPaaSCategory extends AzureSqlSkuCategory {
		sqlPurchasingModel: AzureSqlPurchasingModel;
		sqlServiceTier: AzureSqlPaaSServiceTier;
		hardwareType: AzureSqlPaaSHardwareType;
	}

	export interface AzureSqlSkuIaaSCategory extends AzureSqlSkuCategory {
		virtualMachineFamilyType: VirtualMachineFamilyType;
	}

	export interface AzureManagedDiskSku {
		tier: AzureManagedDiskTier;
		size: string;
		caching: AzureManagedDiskCaching;
	}

	export interface AzureVirtualMachineSku {
		virtualMachineFamily: VirtualMachineFamily;
		sizeName: string;
		computeSize: number;
		azureSkuName: string;
		vCPUsAvailable: number;
	}

	export interface AzureSqlSkuMonthlyCost {
		computeCost: number;
		storageCost: number;
		totalCost: number;
	}

	export interface AzureSqlSku {
		category: AzureSqlSkuPaaSCategory | AzureSqlSkuIaaSCategory;
		computeSize: number;
		predictedDataSizeInMb: number;
		predictedLogSizeInMb: number;
	}

	export interface AzureSqlPaaSSku extends AzureSqlSku {
		category: AzureSqlSkuPaaSCategory;
		storageMaxSizeInMb: number;
	}

	export interface AzureSqlIaaSSku extends AzureSqlSku {
		category: AzureSqlSkuIaaSCategory;
		virtualMachineSize: AzureVirtualMachineSku;
		dataDiskSizes: AzureManagedDiskSku[];
		logDiskSizes: AzureManagedDiskSku[];
		tempDbDiskSizes: AzureManagedDiskSku[];
	}

	export interface SkuRecommendationResultItem {
		sqlInstanceName: string;
		databaseName: string;
		targetSku: AzureSqlIaaSSku | AzureSqlPaaSSku;
		monthlyCost: AzureSqlSkuMonthlyCost;
		ranking: number;
		positiveJustifications: string[];
		negativeJustifications: string[];
	}

	export interface SqlInstanceRequirements {
		cpuRequirementInCores: number;
		dataStorageRequirementInMB: number;
		logStorageRequirementInMB: number;
		memoryRequirementInMB: number;
		dataIOPSRequirement: number;
		logIOPSRequirement: number;
		ioLatencyRequirementInMs: number;
		ioThroughputRequirementInMBps: number;
		tempDBSizeInMB: number;
		dataPointsStartTime: string;
		dataPointsEndTime: string;
		aggregationTargetPercentile: number;
		perfDataCollectionIntervalInSeconds: number;
		databaseLevelRequirements: SqlDatabaseRequirements[];
		numberOfDataPointsAnalyzed: number;
	}

	export interface SqlDatabaseRequirements {
		cpuRequirementInCores: number;
		dataIOPSRequirement: number;
		logIOPSRequirement: number;
		ioLatencyRequirementInMs: number;
		ioThroughputRequirementInMBps: number;
		dataStorageRequirementInMB: number;
		logStorageRequirementInMB: number;
		databaseName: string;
		memoryRequirementInMB: number;
		cpuRequirementInPercentageOfTotalInstance: number;
		numberOfDataPointsAnalyzed: number;
		fileLevelRequirements: SqlFileRequirements[];
	}

	export interface SqlFileRequirements {
		fileName: string;
		fileType: DatabaseFileType;
		sizeInMB: number;
		readLatencyInMs: number;
		writeLatencyInMs: number;
		iopsRequirement: number;
		ioThroughputRequirementInMBps: number;
		numberOfDataPointsAnalyzed: number;
	}

	export interface PaaSSkuRecommendationResultItem extends SkuRecommendationResultItem {
		targetSku: AzureSqlPaaSSku;
	}

	export interface IaaSSkuRecommendationResultItem extends SkuRecommendationResultItem {
		targetSku: AzureSqlIaaSSku;
	}

	export interface SkuRecommendationResult {
		sqlDbRecommendationResults: PaaSSkuRecommendationResultItem[];
		sqlDbRecommendationDurationInMs: number;
		sqlMiRecommendationResults: PaaSSkuRecommendationResultItem[];
		sqlMiRecommendationDurationInMs: number;
		sqlVmRecommendationResults: IaaSSkuRecommendationResultItem[];
		sqlVmRecommendationDurationInMs: number;
		elasticSqlDbRecommendationResults: PaaSSkuRecommendationResultItem[];
		elasticSqlDbRecommendationDurationInMs: number;
		elasticSqlMiRecommendationResults: PaaSSkuRecommendationResultItem[];
		elasticSqlMiRecommendationDurationInMs: number;
		elasticSqlVmRecommendationResults: IaaSSkuRecommendationResultItem[];
		elasticSqlVmRecommendationDurationInMs: number;
		instanceRequirements: SqlInstanceRequirements;
		skuRecommendationReportPaths: string[];
		elasticSkuRecommendationReportPaths: string[];
	}

	// SKU recommendation enums, mirrored from Microsoft.SqlServer.Migration.SkuRecommendation
	export const enum DatabaseFileType {
		Rows = 0,
		Log = 1,
		Filestream = 2,
		NotSupported = 3,
		Fulltext = 4
	}

	export const enum AzureSqlTargetPlatform {
		AzureSqlDatabase = 0,
		AzureSqlManagedInstance = 1,
		AzureSqlVirtualMachine = 2
	}

	export const enum ComputeTier {
		Provisioned = 0,
		ServerLess = 1
	}

	export const enum AzureManagedDiskTier {
		Standard = 0,
		Premium = 1,
		Ultra = 2
	}

	export const enum AzureManagedDiskCaching {
		NotApplicable = 0,
		None = 1,
		ReadOnly = 2,
		ReadWrite = 3
	}

	export const enum AzureSqlPurchasingModel {
		vCore = 0,
	}

	export const enum AzureSqlPaaSServiceTier {
		GeneralPurpose = 0,
		BusinessCritical,
		HyperScale,
	}

	export const enum AzureSqlPaaSHardwareType {
		Gen5 = 0,
		PremiumSeries,
		PremiumSeriesMemoryOptimized
	}

	export const enum VirtualMachineFamilyType {
		GeneralPurpose,
		ComputeOptimized,
		MemoryOptimized,
		StorageOptimized,
		GPU,
		HighPerformanceCompute
	}

	export const enum VirtualMachineFamily {
		basicAFamily,
		standardA0_A7Family,
		standardAv2Family,
		standardBSFamily,
		standardDFamily,
		standardDv2Family,
		standardDv2PromoFamily,
		standardDADSv5Family,
		standardDASv4Family,
		standardDASv5Family,
		standardDAv4Family,
		standardDDSv4Family,
		standardDDSv5Family,
		standardDDv4Family,
		standardDDv5Family,
		standardDSv3Family,
		standardDSv4Family,
		standardDSv5Family,
		standardDv3Family,
		standardDv4Family,
		standardDv5Family,
		standardDCADSv5Family,
		standardDCASv5Family,
		standardDCSv2Family,
		standardDSFamily,
		standardDSv2Family,
		standardDSv2PromoFamily,
		standardEIDSv5Family,
		standardEIDv5Family,
		standardEISv5Family,
		standardEIv5Family,
		standardEADSv5Family,
		standardEASv4Family,
		standardEASv5Family,
		standardEDSv4Family,
		standardEDSv5Family,
		standardEBDSv5Family,
		standardESv3Family,
		standardESv4Family,
		standardESv5Family,
		standardEBSv5Family,
		standardEAv4Family,
		standardEDv4Family,
		standardEDv5Family,
		standardEv3Family,
		standardEv4Family,
		standardEv5Family,
		standardEISv3Family,
		standardEIv3Family,
		standardXEIDSv4Family,
		standardXEISv4Family,
		standardECADSv5Family,
		standardECASv5Family,
		standardECIADSv5Family,
		standardECIASv5Family,
		standardFFamily,
		standardFSFamily,
		standardFSv2Family,
		standardGFamily,
		standardGSFamily,
		standardHFamily,
		standardHPromoFamily,
		standardLSFamily,
		standardLSv2Family,
		standardMSFamily,
		standardMDSMediumMemoryv2Family,
		standardMSMediumMemoryv2Family,
		standardMIDSMediumMemoryv2Family,
		standardMISMediumMemoryv2Family,
		standardMSv2Family,
		standardNCSv3Family,
		StandardNCASv3_T4Family,
		standardNVSv2Family,
		standardNVSv3Family,
		standardNVSv4Family
	}

	export interface StartPerfDataCollectionResult {
		dateTimeStarted: Date;
	}

	export interface StopPerfDataCollectionResult {
		dateTimeStopped: Date;
	}

	export interface RefreshPerfDataCollectionResult {
		isCollecting: boolean;
		messages: string[];
		errors: string[];
		refreshTime: Date;
	}

	export interface ISqlMigrationService {
		getAssessments(ownerUri: string, databases: string[], xEventsFilesFolderPath: string): Promise<AssessmentResult | undefined>;
		getSkuRecommendations(dataFolder: string, perfQueryIntervalInSec: number, targetPlatforms: string[], targetSqlInstance: string, targetPercentile: number, scalingFactor: number, startTime: string, endTime: string, includePreviewSkus: boolean, databaseAllowList: string[]): Promise<SkuRecommendationResult | undefined>;
		startPerfDataCollection(ownerUri: string, dataFolder: string, perfQueryIntervalInSec: number, staticQueryIntervalInSec: number, numberOfIterations: number): Promise<StartPerfDataCollectionResult | undefined>;
		stopPerfDataCollection(): Promise<StopPerfDataCollectionResult | undefined>;
		refreshPerfDataCollection(lastRefreshedTime: Date): Promise<RefreshPerfDataCollectionResult | undefined>;
		startLoginMigration(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
		validateLoginMigration(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
		migrateLogins(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
		establishUserMapping(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
		migrateServerRolesAndSetPermissions(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
	}

	// SqlMigration interfaces  -----------------------------------------------------------------------

	export interface SqlMigrationImpactedObjectInfo {
		name: string;
		impactDetail: string;
		objectType: string;
	}

	export interface SqlMigrationAssessmentResultItem {
		rulesetVersion: string;
		rulesetName: string;
		ruleId: string;
		targetType: string;
		checkId: string;
		tags: string[];
		displayName: string;
		description: string;
		helpLink: string;
		level: string;
		timestamp: string;
		kind: azdata.sqlAssessment.SqlAssessmentResultItemKind;
		message: string;
		appliesToMigrationTargetPlatform: string;
		issueCategory: string;
		databaseName: string;
		impactedObjects: SqlMigrationImpactedObjectInfo[];
		databaseRestoreFails: boolean;
	}

	export interface ServerTargetReadiness {
		numberOfDatabasesReadyForMigration: number;
		numberOfNonOnlineDatabases: number;
		totalNumberOfDatabases: number;
	}

	export interface ErrorModel {
		errorId: number;
		message: string;
		errorSummary: string;
		possibleCauses: string;
		guidance: string;
	}

	export interface DatabaseTargetReadiness {
		noSelectionForMigration: boolean;
		numOfBlockerIssues: number;
	}

	export interface DatabaseAssessmentProperties {
		compatibilityLevel: string;
		databaseSize: number;
		isReplicationEnabled: boolean;
		assessmentTimeInMilliseconds: number;
		items: SqlMigrationAssessmentResultItem[];
		errors: ErrorModel[];
		sqlManagedInstanceTargetReadiness: DatabaseTargetReadiness;
		name: string;
	}

	export interface ServerAssessmentProperties {
		cpuCoreCount: number;
		physicalServerMemory: number;
		serverHostPlatform: string;
		serverVersion: string;
		serverEngineEdition: string;
		serverEdition: string;
		isClustered: boolean;
		numberOfUserDatabases: number;
		sqlAssessmentStatus: number;
		assessedDatabaseCount: number;
		sqlManagedInstanceTargetReadiness: ServerTargetReadiness;
		items: SqlMigrationAssessmentResultItem[];
		errors: ErrorModel[];
		databases: DatabaseAssessmentProperties[];
		name: string;
	}

	export interface AssessmentResult {
		startTime: string;
		endedTime: string;
		assessmentResult: ServerAssessmentProperties;
		rawAssessmentResult: any;
		errors: ErrorModel[];
		assessmentReportPath: string;
	}

	export interface CreateSasResponse {
		sharedAccessSignature: string;
	}

	export interface IAzureBlobService {
		/**
		 * Create a shared access signature for the specified blob container URI and saves it to the server specified with the connectionUri
		 * @param connectionUri The connection URI of the server to save the SAS to
		 * @param blobContainerUri The blob container URI to create the SAS for
		 * @param blobStorageKey The key used to access the storage account
		 * @param storageAccountName The name of the storage account the SAS will be created for
		 * @param expirationDate The expiration date of the SAS
		 * @returns A created shared access signature token
		 */
		createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Promise<CreateSasResponse>;
	}

	export enum LoginMigrationStep {
		StartValidations = 0,
		MigrateLogins = 1,
		EstablishUserMapping = 2,
		MigrateServerRoles = 3,
		EstablishServerRoleMapping = 4,
		SetLoginPermissions = 5,
		SetServerRolePermissions = 6,
	}

	export interface StartLoginMigrationResult {
		exceptionMap: { [login: string]: any };
		completedStep: LoginMigrationStep;
		elapsedTime: string;
	}

	// TDEMigration interfaces  BEGIN -----------------------------------------------------------------------
	export interface TdeMigrationRequest {
		encryptedDatabases: string[];
		sourceSqlConnectionString: string;
		targetSubscriptionId: string;
		targetResourceGroupName: string;
		targetManagedInstanceName: string;
	}

	export interface TdeMigrationEntryResult {
		dbName: string;
		success: boolean;
		message: string;
	}

	export interface TdeMigrationResult {
		migrationStatuses: TdeMigrationEntryResult[];
	}

	export interface ITdeMigrationService {
		migrateCertificate(
			encryptedDatabases: string[],
			sourceSqlConnectionString: string,
			targetSubscriptionId: string,
			targetResourceGroupName: string,
			targetManagedInstanceName: string,
			networkSharePath: string,
			accessToken: string,
			reportUpdate: (dbName: string, succeeded: boolean, message: string) => void): Promise<TdeMigrationResult>;
	}
	// TDEMigration interfaces END -----------------------------------------------------------------------

	// Object Management Service
	export namespace ObjectManagement {
		/**
		 * Base interface for all the objects.
		 */
		export interface SqlObject {
			/**
			 * Name of the object.
			 */
			name: string;
		}

		/**
		 * Base interface for the object view information
		 */
		export interface ObjectViewInfo<T extends SqlObject> {
			/**
			 * The object information
			 */
			objectInfo: T;
		}

		/**
		 * Server level login.
		 */
		export interface Login extends SqlObject {
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
		export enum AuthenticationType {
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
		export interface LoginViewInfo extends ObjectViewInfo<Login> {
			/**
			 * Whether Windows Authentication is supported.
			 */
			supportWindowsAuthentication: boolean;
			/**
			 * Whether Azure Active Directory Authentication is supported.
			 */
			supportAADAuthentication: boolean;
			/**
			 * Whether SQL Authentication is supported.
			 */
			supportSQLAuthentication: boolean;
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
		export interface Permission {
			/**
			 * Name of the permission.
			 */
			name: string;
			/**
			 * Whether the permission is granted or denied.
			 */
			grant: boolean;
			/**
			 * Whether the pincipal can grant this permission to other principals.
			 * The value will be ignored if the grant property is set to false.
			 */
			withGrant: boolean;
		}

		/**
		 * The permissions a principal has over a securable.
		 */
		export interface SecurablePermissions {
			/**
			 * The securable.
			 */
			securable: SqlObject;
			/**
			 * The Permissions.
			 */
			permissions: Permission[];
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
		export enum UserType {
			/**
			 * User with a server level login.
			 */
			WithLogin = 'WithLogin',
			/**
			 * User based on a Windows user/group that has no login, but can connect to the Database Engine through membership in a Windows group.
			 */
			WithWindowsGroupLogin = 'WithWindowsGroupLogin',
			/**
			 * Contained user, authentication is done within the database.
			 */
			Contained = 'Contained',
			/**
			 * User that cannot authenticate.
			 */
			NoConnectAccess = 'NoConnectAccess'
		}

		/**
		 * Database user.
		 */
		export interface User extends SqlObject {
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
			ownedSchemas: string[] | undefined;
			/**
			 * Database roles that the user belongs to.
			 */
			databaseRoles: string[] | undefined;
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
			 * Authentication type.
			 * Only applicable when user type is 'Contained'.
			 */
			authenticationType: AuthenticationType | undefined;
			/**
			 * Password of the user.
			 * Only applicable when the user type is 'Contained' and the authentication type is 'Sql'.
			 */
			password: string | undefined;
		}

		/**
		 * The information required to render the user view.
		 */
		export interface UserViewInfo extends ObjectViewInfo<User> {
			/**
			 * Whether contained user is supported.
			 */
			supportContainedUser: boolean;
			/**
			 * Whether Windows authentication is supported.
			 */
			supportWindowsAuthentication: boolean;
			/**
			 * Whether Azure Active Directory authentication is supported.
			 */
			supportAADAuthentication: boolean;
			/**
			 * Whether SQL Authentication is supported.
			 */
			supportSQLAuthentication: boolean;
			/**
			 * All languages supported by the database.
			 */
			languages: string[];
			/**
			 * All schemas in the database.
			 */
			schemas: string[];
			/**
			 * Name of all the logins in the server.
			 */
			logins: string[];
			/**
			 * Name of all the database roles.
			 */
			databaseRoles: string[];
		}
	}

	export interface IObjectManagementService {
		/**
		 * Initialize the login view and return the information to render the view.
		 * @param connectionUri The original connection's URI.
		 * @param contextId The context id of the view, generated by the extension and will be used in subsequent create/update/dispose operations.
		 * @param isNewObject Whether the view is for creating a new login object.
		 * @param name Name of the login. Only applicable when isNewObject is false.
		 */
		initializeLoginView(connectionUri: string, contextId: string, isNewObject: boolean, name: string | undefined): Thenable<ObjectManagement.LoginViewInfo>;
		/**
		 * Create a login.
		 * @param contextId The login view's context id.
		 * @param login The login information.
		 */
		createLogin(contextId: string, login: ObjectManagement.Login): Thenable<void>;
		/**
		 * Update a login.
		 * @param contextId The login view's context id.
		 * @param login The login information.
		 */
		updateLogin(contextId: string, login: ObjectManagement.Login): Thenable<void>;
		/**
		 * Delete a login.
		 * @param connectionUri The URI of the server connection.
		 * @param name Name of the login.
		 */
		deleteLogin(connectionUri: string, name: string): Thenable<void>;
		/**
		 * Dispose the login view.
		 * @param contextId The id of the view.
		 */
		disposeLoginView(contextId: string): Thenable<void>;
		/**
		 * Initialize the user view and return the information to render the view.
		 * @param connectionUri The original connection's URI.
		 * @param database Name of the database.
		 * @param contextId The id of the view, generated by the extension and will be used in subsequent create/update/dispose operations.
		 * @param isNewObject Whether the view is for creating a new user object.
		 * @param name Name of the user. Only applicable when isNewObject is false.
		 */
		initializeUserView(connectionUri: string, database: string, contextId: string, isNewObject: boolean, name: string | undefined): Thenable<ObjectManagement.UserViewInfo>;
		/**
		 * Create a user.
		 * @param contextId Id of the view.
		 * @param user The user information.
		 */
		createUser(contextId: string, user: ObjectManagement.User): Thenable<void>;
		/**
		 * Create a login.
		 * @param contextId Id of the view.
		 * @param user The user information.
		 */
		updateUser(contextId: string, user: ObjectManagement.User): Thenable<void>;
		/**
		 * Create a login.
		 * @param connectionUri The URI of the server connection.
		 * @param database Name of the database.
		 * @param name Name of the user.
		 */
		deleteUser(connectionUri: string, database: string, name: string): Thenable<void>;
		/**
		 * Dispose the user view.
		 * @param contextId The id of the view.
		 */
		disposeUserView(contextId: string): Thenable<void>;
	}
	//
}
