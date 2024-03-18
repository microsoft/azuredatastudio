/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestType, NotificationType } from 'vscode-languageclient';
import * as azdata from 'azdata';

export interface IMessage {
	jsonrpc: string;
}

export interface SqlMigrationAssessmentParams {
	connectionString: string;
	databases: string[];
	xEventsFilesFolderPath: string;
	collectAdhocQueries: boolean;
}

export interface SqlMigrationImpactedObjectInfo {
	name: string;
	impactDetail: string;
	objectType: string;
}

export interface SqlMigrationAssessmentResultItem {
	serverName: string;
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

export namespace GetSqlMigrationAssessmentItemsRequest {
	export const type = new RequestType<SqlMigrationAssessmentParams, AssessmentResult, void, void>('migration/getassessments');
}

export namespace GetSqlMigrationGenerateArmTemplateRequest {
	export const type = new RequestType<string, string, void, void>('migration/getarmtemplate');
}

export interface SqlMigrationSkuRecommendationsParams {
	dataFolder: string;
	perfQueryIntervalInSec: number;
	targetPlatforms: string[];
	targetSqlInstance: string;
	targetPercentile: number;
	scalingFactor: number;
	startTime: string;
	endTime: string;
	includePreviewSkus: boolean;
	databaseAllowList: string[];
	isPremiumSSDV2Enabled: boolean;
}

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
	type: AzureManagedDiskType;
	maxSizeInGib: number;
	maxThroughputInMbps: number;
	maxIOPS: number;
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

// values from SQL NuGet
export const enum AzureManagedDiskType {
	StandardHDD = 1,   // Standard HDD
	StandardSSD = 2,   // Standard SSD
	PremiumSSD = 4,    // Premium SSD
	UltraSSD = 8,      // Ultra SSD
	PremiumSSDV2 = 16,    // Premium SSD V2
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

export const enum TdeValidationStatus {
	Failed = -1,
	Succeeded = 1
}

export namespace GetSqlMigrationSkuRecommendationsRequest {
	export const type = new RequestType<SqlMigrationSkuRecommendationsParams, SkuRecommendationResult, void, void>('migration/getskurecommendations');
}

export interface SqlMigrationStartPerfDataCollectionParams {
	connectionString: string,
	dataFolder: string,
	perfQueryIntervalInSec: number,
	staticQueryIntervalInSec: number,
	numberOfIterations: number
}

export interface StartPerfDataCollectionResult {
	dateTimeStarted: Date;
}

export namespace SqlMigrationStartPerfDataCollectionRequest {
	export const type = new RequestType<SqlMigrationStartPerfDataCollectionParams, StartPerfDataCollectionResult, void, void>('migration/startperfdatacollection');
}

export interface SqlMigrationStopPerfDataCollectionParams {
}

export interface StopPerfDataCollectionResult {
	dateTimeStopped: Date;
}

export namespace SqlMigrationStopPerfDataCollectionRequest {
	export const type = new RequestType<SqlMigrationStopPerfDataCollectionParams, StopPerfDataCollectionResult, void, void>('migration/stopperfdatacollection');
}

export interface SqlMigrationRefreshPerfDataCollectionParams {
	lastRefreshTime: Date
}
export interface RefreshPerfDataCollectionResult {
	isCollecting: boolean;
	messages: string[];
	errors: string[];
	refreshTime: Date;
}

export namespace SqlMigrationRefreshPerfDataCollectionRequest {
	export const type = new RequestType<SqlMigrationRefreshPerfDataCollectionParams, RefreshPerfDataCollectionResult, void, void>('migration/refreshperfdatacollection');
}

export interface StartLoginMigrationsParams {
	sourceConnectionString: string;
	targetConnectionString: string;
	loginList: string[];
	aadDomainName: string;
}

export enum LoginMigrationPreValidationStep {
	SysAdminValidation = 0,
	AADDomainNameValidation = 1,
	UserMappingValidation = 2,
	LoginEligibilityValidation = 3,
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

export interface StartLoginMigrationPreValidationResult {
	exceptionMap: { [login: string]: any };
	completedStep: LoginMigrationPreValidationStep;
	elapsedTime: string;
}

export interface StartLoginMigrationResult {
	exceptionMap: { [login: string]: any };
	completedStep: LoginMigrationStep;
	elapsedTime: string;
}

export namespace StartLoginMigrationRequest {
	export const type = new RequestType<StartLoginMigrationsParams, StartLoginMigrationResult, void, void>('migration/startloginmigration');
}

export namespace ValidateLoginMigrationRequest {
	export const type = new RequestType<StartLoginMigrationsParams, StartLoginMigrationResult, void, void>('migration/validateloginmigration');
}

export namespace ValidateSysAdminPermissionRequest {
	export const type =
		new RequestType<StartLoginMigrationsParams, StartLoginMigrationPreValidationResult, void, void>("migration/validatesysadminpermission");
}

export namespace ValidateUserMappingRequest {
	export const type =
		new RequestType<StartLoginMigrationsParams, StartLoginMigrationPreValidationResult, void, void>("migration/validateusermapping");
}

export namespace ValidateAADDomainNameRequest {
	export const type =
		new RequestType<StartLoginMigrationsParams, StartLoginMigrationPreValidationResult, void, void>("migration/validateaaddomainname");
}

export namespace ValidateLoginEligibilityRequest {
	export const type =
		new RequestType<StartLoginMigrationsParams, StartLoginMigrationPreValidationResult, void, void>("migration/validatelogineligibility");
}

export namespace MigrateLoginsRequest {
	export const type = new RequestType<StartLoginMigrationsParams, StartLoginMigrationResult, void, void>('migration/migratelogins');
}

export namespace EstablishUserMappingRequest {
	export const type = new RequestType<StartLoginMigrationsParams, StartLoginMigrationResult, void, void>('migration/establishusermapping');
}

export namespace MigrateServerRolesAndSetPermissionsRequest {
	export const type = new RequestType<StartLoginMigrationsParams, StartLoginMigrationResult, void, void>('migration/migrateserverrolesandsetpermissions');
}

export namespace LoginMigrationNotification {
	export const type = new NotificationType<StartLoginMigrationResult, void>('migration/loginmigrationnotification"');
}

export interface ISqlMigrationService {
	providerId: string;
	getAssessments(ownerUri: string, databases: string[], xEventsFilesFolderPath: string, collectAdhocQueries: boolean): Thenable<AssessmentResult | undefined>;
	getSkuRecommendations(dataFolder: string, perfQueryIntervalInSec: number, targetPlatforms: string[], targetSqlInstance: string, targetPercentile: number, scalingFactor: number, startTime: string, endTime: string, includePreviewSkus: boolean, databaseAllowList: string[]): Promise<SkuRecommendationResult | undefined>;
	startPerfDataCollection(ownerUri: string, dataFolder: string, perfQueryIntervalInSec: number, staticQueryIntervalInSec: number, numberOfIterations: number): Promise<StartPerfDataCollectionResult | undefined>;
	stopPerfDataCollection(): Promise<StopPerfDataCollectionResult | undefined>;
	refreshPerfDataCollection(lastRefreshedTime: Date): Promise<RefreshPerfDataCollectionResult | undefined>;
	getArmTemplate(targetType: string): Promise<string | undefined>;
	startLoginMigration(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
	validateLoginMigration(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
	validateSysAdminPermission(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationPreValidationResult | undefined>;
	validateUserMapping(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationPreValidationResult | undefined>;
	validateAADDomainName(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationPreValidationResult | undefined>;
	validateLoginEligibility(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationPreValidationResult | undefined>;
	migrateLogins(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
	establishUserMapping(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
	migrateServerRolesAndSetPermissions(sourceConnectionString: string, targetConnectionString: string, loginList: string[], aadDomainName: string): Promise<StartLoginMigrationResult | undefined>;
	migrateCertificate(
		encryptedDatabases: string[],
		sourceSqlConnectionString: string,
		targetSubscriptionId: string,
		targetResourceGroupName: string,
		targetManagedInstanceName: string,
		networkSharePath: string,
		accessToken: string,
		reportUpdate: (dbName: string, succeeded: boolean, message: string, statusCode: string) => void): Promise<TdeMigrationResult | undefined>;
}

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

export namespace TdeMigrateRequest {
	export const type = new RequestType<TdeMigrationParams, TdeMigrationResult, void, void>('migration/tdemigration');
}

export interface TdeMigrationParams {
	encryptedDatabases: string[];
	sourceSqlConnectionString: string;
	targetSubscriptionId: string;
	targetResourceGroupName: string;
	targetManagedInstanceName: string;
	networkSharePath: string;
	networkShareDomain: string;
	networkShareUserName: string;
	networkSharePassword: string;
	accessToken: string;
}

export namespace TdeMigrateProgressEvent {
	export const type = new NotificationType<TdeMigrateProgressParams, void>('migration/tdemigrationprogress');
}


export interface TdeMigrateProgressParams {
	name: string;
	success: boolean;
	message: string;
	statusCode: string;
}

export interface TdeValidationResult {
	validationTitle: string;
	validationDescription: string;
	validationTroubleshootingTips: string;
	validationErrorMessage: string;
	validationStatus: TdeValidationStatus;
	validationStatusString: string;
}

export interface TdeValidationParams {
	sourceSqlConnectionString: string;
	networkSharePath: string;
}

export namespace TdeValidationRequest {
	export const type = new RequestType<TdeValidationParams, TdeValidationResult[], void, void>('migration/tdevalidation');
}

export namespace TdeValidationTitlesRequest {
	export const type = new RequestType<{}, string[], void, void>('migration/tdevalidationtitles');
}
