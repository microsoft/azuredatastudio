/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import * as contracts from '../service/contracts';
import * as features from '../service/features';
import { SqlMigrationService, SqlManagedInstance, startDatabaseMigration, StartDatabaseMigrationRequest, StorageAccount, SqlVMServer, getSqlManagedInstanceDatabases, AzureSqlDatabaseServer, VirtualMachineInstanceView } from '../api/azure';
import * as constants from '../constants/strings';
import * as nls from 'vscode-nls';
import { v4 as uuidv4 } from 'uuid';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews, logError } from '../telemetry';
import { hashString, deepClone, getBlobContainerNameWithFolder, Blob, getLastBackupFileNameWithoutFolder, MigrationTargetType } from '../api/utils';
import { SKURecommendationPage } from '../wizard/skuRecommendation/skuRecommendationPage';
import { excludeDatabases, getEncryptConnectionValue, getSourceConnectionId, getSourceConnectionProfile, getSourceConnectionServerInfo, getSourceConnectionString, getSourceConnectionUri, getTrustServerCertificateValue, SourceDatabaseInfo, TargetDatabaseInfo } from '../api/sqlUtils';
import { LoginMigrationModel } from './loginMigrationModel';
import { TdeMigrationDbResult, TdeMigrationModel, TdeValidationResult } from './tdeModels';
import { NetworkInterfaceModel } from '../api/dataModels/azure/networkInterfaceModel';
const localize = nls.loadMessageBundle();

export enum ValidateIrState {
	Pending = 'Pending',
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export interface ValidationResult {
	errors: string[];
	state: ValidateIrState;
}

export enum State {
	INIT,
	COLLECTING_SOURCE_INFO,
	COLLECTION_SOURCE_INFO_ERROR,
	TARGET_SELECTION,
	TARGET_SELECTION_ERROR,
	AZURE_SERVER_SELECTION,
	AZURE_SERVER_SELECTION_ERROR,
	AZURE_DB_BACKUP,
	AZURE_DB_BACKUP_ERROR,
	MIGRATION_AGENT_CREATION,
	MIGRATION_AGENT_SELECTION,
	MIGRATION_AGENT_ERROR,
	MIGRATION_START,
	NO_AZURE_SERVER,
	EXIT,
}

export enum ServiceTier {
	GeneralPurpose = 'GeneralPurpose',
	BusinessCritical = 'BusinessCritical',
}

export enum MigrationSourceAuthenticationType {
	Integrated = 'WindowsAuthentication',
	Sql = 'SqlAuthentication'
}

export enum AssessmentRuleId {
	TdeEnabled = 'TdeEnabled'
}

export enum MigrationMode {
	ONLINE,
	OFFLINE
}

export enum NetworkContainerType {
	FILE_SHARE,
	BLOB_CONTAINER,
	NETWORK_SHARE
}

export enum FileStorageType {
	FileShare = 'FileShare',
	AzureBlob = 'AzureBlob',
	None = 'None',
}

export enum Page {
	ImportAssessment,
	DatabaseSelector,
	SKURecommendation,
	TargetSelection,
	IntegrationRuntime,
	DatabaseBackup,
	Summary
}

export enum WizardEntryPoint {
	Default = 'Default',
	SaveAndClose = 'SaveAndClose',
	RestartMigration = 'RestartMigration',
}

export enum PerformanceDataSourceOptions {
	CollectData = 'CollectData',
	OpenExisting = 'OpenExisting',
}

export interface DatabaseBackupModel {
	migrationMode: MigrationMode;
	networkContainerType: NetworkContainerType;
	networkShares: NetworkShare[];
	subscription: azurecore.azureResource.AzureResourceSubscription;
	blobs: Blob[];
}

export interface NetworkShare {
	networkShareLocation: string;
	windowsUser: string;
	password: string;
	resourceGroup: azurecore.azureResource.AzureResourceResourceGroup;
	storageAccount: StorageAccount;
	storageKey: string;
}

export interface Model {
	readonly currentState: State;
	gatheringInformationError: string | undefined;
	_azureAccount: azdata.Account | undefined;
	_databaseBackup: DatabaseBackupModel | undefined;
}

export interface StateChangeEvent {
	oldState: State;
	newState: State;
}

export interface SavedInfo {
	closedPage: number;
	databaseAssessment: string[];
	databaseList: string[];
	databaseInfoList: SourceDatabaseInfo[];
	migrationTargetType: MigrationTargetType | null;
	azureAccount: azdata.Account | null;
	azureTenant: azurecore.Tenant | null;
	subscription: azurecore.azureResource.AzureResourceSubscription | null;
	location: azurecore.azureResource.AzureLocation | null;
	resourceGroup: azurecore.azureResource.AzureResourceResourceGroup | null;
	targetServerInstance: azurecore.azureResource.AzureSqlManagedInstance | SqlVMServer | AzureSqlDatabaseServer | null;
	migrationMode: MigrationMode | null;
	networkContainerType: NetworkContainerType | null;
	networkShares: NetworkShare[];
	blobs: Blob[];
	targetDatabaseNames: string[];
	sqlMigrationService: SqlMigrationService | undefined;
	serviceSubscription: azurecore.azureResource.AzureResourceSubscription | null;
	serviceResourceGroup: azurecore.azureResource.AzureResourceResourceGroup | null;
	serverAssessment: ServerAssessment | null;
	xEventsFilesFolderPath: string | null;
	skuRecommendation: SkuRecommendationSavedInfo | null;
}

export interface SkuRecommendationSavedInfo {
	skuRecommendationPerformanceDataSource: PerformanceDataSourceOptions;
	skuRecommendationPerformanceLocation: string;
	perfDataCollectionStartDate?: Date;
	perfDataCollectionStopDate?: Date;
	skuTargetPercentile: number;
	skuScalingFactor: number;
	skuEnablePreview: boolean;
}

export class MigrationStateModel implements Model, vscode.Disposable {

	public _azureAccounts!: azdata.Account[];
	public _azureAccount!: azdata.Account;
	public _accountTenants!: azurecore.Tenant[];
	public _azureTenant!: azurecore.Tenant;

	public _connecionProfile!: azdata.connection.ConnectionProfile;
	public _authenticationType!: MigrationSourceAuthenticationType;
	public _sqlServerUsername!: string;
	public _sqlServerPassword!: string;

	public _subscriptions!: azurecore.azureResource.AzureResourceSubscription[];
	public _targetSubscription!: azurecore.azureResource.AzureResourceSubscription;
	public _locations!: azurecore.azureResource.AzureLocation[];
	public _location!: azurecore.azureResource.AzureLocation;
	public _resourceGroups!: azurecore.azureResource.AzureResourceResourceGroup[];
	public _resourceGroup!: azurecore.azureResource.AzureResourceResourceGroup;
	public _targetManagedInstances!: SqlManagedInstance[];
	public _targetSqlVirtualMachines!: SqlVMServer[];
	public _targetSqlDatabaseServers!: AzureSqlDatabaseServer[];
	public _targetServerInstance!: SqlManagedInstance | SqlVMServer | AzureSqlDatabaseServer;
	public _vmInstanceView!: VirtualMachineInstanceView;
	public _databaseBackup!: DatabaseBackupModel;
	public _storageAccounts!: StorageAccount[];
	public _fileShares!: azurecore.azureResource.FileShare[];
	public _blobContainers!: azurecore.azureResource.BlobContainer[];
	public _lastFileNames!: azurecore.azureResource.Blob[];
	public _blobContainerFolders!: string[];
	public _sourceDatabaseNames!: string[];
	public _targetDatabaseNames!: string[];

	public _targetServerName!: string;
	public _targetUserName!: string;
	public _targetPassword!: string;
	public _targetPort!: string;
	public _sourceTargetMapping: Map<string, TargetDatabaseInfo | undefined> = new Map();

	public _sqlMigrationServiceSubscription!: azurecore.azureResource.AzureResourceSubscription;
	public _sqlMigrationServiceResourceGroup!: azurecore.azureResource.AzureResourceResourceGroup;
	public _sqlMigrationService!: SqlMigrationService | undefined;
	public _sqlMigrationServices!: SqlMigrationService[];
	public _nodeNames!: string[];

	public _databasesForAssessment!: string[];
	public _xEventsFilesFolderPath: string = '';
	public _assessmentResults!: ServerAssessment;
	public _assessedDatabaseList!: string[];
	public _runAssessments: boolean = true;
	private _assessmentApiResponse!: contracts.AssessmentResult;
	public _assessmentReportFilePath: string;
	public mementoString: string;

	public _databasesForMigration: string[] = [];
	public _databaseInfosForMigrationMap: Map<string, SourceDatabaseInfo | undefined> = new Map();
	public _databaseInfosForMigration: SourceDatabaseInfo[] = [];
	public _didUpdateDatabasesForMigration: boolean = false;
	public _didDatabaseMappingChange: boolean = false;
	public _vmDbs: string[] = [];
	public _miDbs: string[] = [];
	public _sqldbDbs: string[] = [];
	public _targetType!: MigrationTargetType;

	public _validateIrSqlDb: ValidationResult[] = [];
	public _validateIrSqlMi: ValidationResult[] = [];
	public _validateIrSqlVm: ValidationResult[] = [];

	public _skuRecommendationResults!: SkuRecommendation;
	public _skuRecommendationPerformanceDataSource!: PerformanceDataSourceOptions;
	private _skuRecommendationApiResponse!: contracts.SkuRecommendationResult;
	public _skuRecommendationReportFilePaths: string[];
	public _skuRecommendationPerformanceLocation!: string;

	public _perfDataCollectionStartDate!: Date | undefined;
	public _perfDataCollectionStopDate!: Date | undefined;
	public _perfDataCollectionLastRefreshedDate!: Date;
	public _perfDataCollectionMessages!: string[];
	public _perfDataCollectionErrors!: string[];
	public _perfDataCollectionIsCollecting!: boolean;

	public _aadDomainName!: string;
	public _loginMigrationModel: LoginMigrationModel;

	public readonly _refreshGetSkuRecommendationIntervalInMinutes = 10;
	public readonly _performanceDataQueryIntervalInSeconds = 30;
	public readonly _staticDataQueryIntervalInSeconds = 60;
	public readonly _numberOfPerformanceDataQueryIterations = 19;
	public readonly _defaultDataPointStartTime = '1900-01-01 00:00:00';
	public readonly _defaultDataPointEndTime = '2200-01-01 00:00:00';
	public readonly _sqlMiEndpointSuffix = "database.windows.net";
	public readonly _recommendationTargetPlatforms = [MigrationTargetType.SQLDB, MigrationTargetType.SQLMI, MigrationTargetType.SQLVM];

	public refreshPerfDataCollectionFrequency = this._performanceDataQueryIntervalInSeconds * 1000;
	public refreshGetSkuRecommendationFrequency = constants.TIME_IN_MINUTES(this._refreshGetSkuRecommendationIntervalInMinutes);

	public _skuScalingFactor!: number;
	public _skuTargetPercentile!: number;
	public _skuEnablePreview!: boolean;
	public _skuEnableElastic!: boolean;

	public refreshDatabaseBackupPage!: boolean;
	public restartMigration!: boolean;
	public resumeAssessment!: boolean;
	public savedInfo!: SavedInfo;
	public closedPage!: number;
	public _sessionId: string = uuidv4();
	public serverName!: string;

	public tdeMigrationConfig: TdeMigrationModel = new TdeMigrationModel();

	public isSchemaMigrationSupported: boolean = true;

	private _stateChangeEventEmitter = new vscode.EventEmitter<StateChangeEvent>();
	private _currentState: State;
	private _gatheringInformationError: string | undefined;
	private _skuRecommendationRecommendedDatabaseList!: string[];
	private _startPerfDataCollectionApiResponse!: contracts.StartPerfDataCollectionResult;
	private _stopPerfDataCollectionApiResponse!: contracts.StopPerfDataCollectionResult;
	private _refreshPerfDataCollectionApiResponse!: contracts.RefreshPerfDataCollectionResult;
	private _autoRefreshPerfDataCollectionHandle!: NodeJS.Timeout;
	private _autoRefreshGetSkuRecommendationHandle!: NodeJS.Timeout;

	constructor(
		public extensionContext: vscode.ExtensionContext,
		public readonly migrationService: features.SqlMigrationService,
	) {
		this._currentState = State.INIT;
		this._databaseBackup = {} as DatabaseBackupModel;
		this._databaseBackup.networkShares = [];
		this._databaseBackup.blobs = [];
		this._databaseBackup.networkContainerType = NetworkContainerType.BLOB_CONTAINER;
		this._targetDatabaseNames = [];
		this._assessmentReportFilePath = '';
		this._skuRecommendationReportFilePaths = [];
		this.mementoString = 'sqlMigration.assessmentResults';
		this._targetManagedInstances = [];

		this._skuScalingFactor = 100;
		this._skuTargetPercentile = 95;
		this._skuEnablePreview = false;
		this._skuEnableElastic = false;
		this._loginMigrationModel = new LoginMigrationModel();
	}

	public get validationTargetResults(): ValidationResult[] {
		switch (this._targetType) {
			case MigrationTargetType.SQLDB:
				return this._validateIrSqlDb;
			case MigrationTargetType.SQLMI:
				return this._validateIrSqlMi;
			case MigrationTargetType.SQLVM:
				return this._validateIrSqlVm;
			default:
				return [];
		}
	}

	public resetIrValidationResults(): void {
		if (this.isIrMigration) {
			this._validateIrSqlDb = [];
			this._validateIrSqlMi = [];
			this._validateIrSqlVm = [];
		}
	}

	public get isSqlVmTarget(): boolean {
		return this._targetType === MigrationTargetType.SQLVM;
	}

	public get isSqlMiTarget(): boolean {
		return this._targetType === MigrationTargetType.SQLMI;
	}

	public get isSqlDbTarget(): boolean {
		return this._targetType === MigrationTargetType.SQLDB;
	}

	public get isIrTargetValidated(): boolean {
		const results = this.validationTargetResults ?? [];
		return results.length > 1
			&& results.every(r =>
				r.errors.length === 0 &&
				r.state === ValidateIrState.Succeeded)
	}

	public get migrationTargetServerName(): string {
		switch (this._targetType) {
			case MigrationTargetType.SQLMI:
				return (this._targetServerInstance as azurecore.azureResource.AzureSqlManagedInstance)?.name;
			case MigrationTargetType.SQLVM:
				return (this._targetServerInstance as SqlVMServer)?.name;
			case MigrationTargetType.SQLDB:
				return (this._targetServerInstance as AzureSqlDatabaseServer)?.name;
			default:
				return '';
		}
	}

	public get isBackupContainerNetworkShare(): boolean {
		return this._databaseBackup?.networkContainerType === NetworkContainerType.NETWORK_SHARE;
	}

	public get isBackupContainerBlobContainer(): boolean {
		return this._databaseBackup?.networkContainerType === NetworkContainerType.BLOB_CONTAINER;
	}

	public get isIrMigration(): boolean {
		return this.isSqlDbTarget
			|| this.isBackupContainerNetworkShare;
	}

	public get currentState(): State {
		return this._currentState;
	}

	public set currentState(newState: State) {
		const oldState = this.currentState;
		this._currentState = newState;
		this._stateChangeEventEmitter.fire({ oldState, newState: this.currentState });
	}
	public async getDatabases(): Promise<string[]> {
		const temp = await azdata.connection.listDatabases(await getSourceConnectionId());
		const finalResult = temp.filter((name) => !excludeDatabases.includes(name));
		return finalResult;
	}
	public hasRecommendedDatabaseListChanged(): boolean {
		const oldDbList = this._skuRecommendationRecommendedDatabaseList;
		const newDbList = this._databasesForAssessment;

		if (!oldDbList || !newDbList) {
			return false;
		}
		return !((oldDbList.length === newDbList.length) && oldDbList.every(function (element, index) {
			return element === newDbList[index];
		}));
	}

	public async getDatabaseAssessments(targetType: MigrationTargetType[]): Promise<ServerAssessment> {
		const connectionString = await getSourceConnectionString();
		try {
			const response = (await this.migrationService.getAssessments(connectionString, this._databasesForAssessment, this._xEventsFilesFolderPath ?? ''))!;
			this._assessmentApiResponse = response;
			this._assessedDatabaseList = this._databasesForAssessment.slice();

			if (response?.assessmentResult) {
				response.assessmentResult.items = response.assessmentResult.items?.filter(
					issue => targetType.includes(
						<MigrationTargetType>issue.appliesToMigrationTargetPlatform));

				response.assessmentResult.databases?.forEach(
					database => database.items = database.items?.filter(
						issue => targetType.includes(
							<MigrationTargetType>issue.appliesToMigrationTargetPlatform)));

				this._assessmentResults = {
					issues: this._assessmentApiResponse?.assessmentResult?.items || [],
					databaseAssessments: this._assessmentApiResponse?.assessmentResult?.databases?.map(d => {
						return {
							name: d.name,
							issues: d.items,
							errors: d.errors,
						};
					}) ?? [],
					errors: this._assessmentApiResponse?.errors ?? []
				};
				this._assessmentReportFilePath = response.assessmentReportPath;
			} else {
				this._assessmentResults = {
					issues: [],
					databaseAssessments: this._databasesForAssessment?.map(database => {
						return {
							name: database,
							issues: [],
							errors: []
						};
					}) ?? [],
					errors: response?.errors ?? [],
				};
			}

		} catch (error) {
			this._assessmentResults = {
				issues: [],
				databaseAssessments: this._databasesForAssessment?.map(database => {
					return {
						name: database,
						issues: [],
						errors: []
					};
				}) ?? [],
				errors: [],
				assessmentError: error
			};
		}

		// Generating all the telemetry asynchronously as we don't need to block the user for it.
		this.generateAssessmentTelemetry().catch(e => console.error(e));
		return this._assessmentResults;
	}

	public async getSkuRecommendations(): Promise<SkuRecommendation> {
		try {
			let fullInstanceName: string;

			// execute a query against the source to get the correct instance name
			const connectionProfile = await getSourceConnectionProfile();
			const connectionUri = await getSourceConnectionUri();
			const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(connectionProfile.providerId, azdata.DataProviderType.QueryProvider);
			const queryString = 'SELECT SERVERPROPERTY(\'ServerName\');';
			const queryResult = await queryProvider.runQueryAndReturn(connectionUri, queryString);

			if (queryResult.rowCount > 0) {
				fullInstanceName = queryResult.rows[0][0].displayValue;
			} else {
				// get the instance name from connection info in case querying for the instance name doesn't work for whatever reason
				const serverInfo = await getSourceConnectionServerInfo();
				const machineName = (<any>serverInfo)['machineName'];				// contains the correct machine name but not necessarily the correct instance name
				const instanceName = connectionProfile.serverName;					// contains the correct instance name but not necessarily the correct machine name

				if (instanceName.includes('\\')) {
					fullInstanceName = machineName + '\\' + instanceName.substring(instanceName.indexOf('\\') + 1);
				} else {
					fullInstanceName = machineName;
				}
			}

			const response = (await this.migrationService.getSkuRecommendations(
				this._skuRecommendationPerformanceLocation,
				this._performanceDataQueryIntervalInSeconds,
				this._recommendationTargetPlatforms.map(p => p.toString()),
				fullInstanceName,
				this._skuTargetPercentile,
				this._skuScalingFactor,
				this._defaultDataPointStartTime,
				this._defaultDataPointEndTime,
				this._skuEnablePreview,
				this._databasesForAssessment))!;
			this._skuRecommendationApiResponse = response;

			// clone list of databases currently being assessed and store them, so that if the user ever changes the list we can refresh new recommendations
			this._skuRecommendationRecommendedDatabaseList = this._databasesForAssessment.slice();

			if (response) {
				this._skuRecommendationResults = {
					recommendations: response
				};
				this._skuRecommendationReportFilePaths = this._skuEnableElastic ? response.elasticSkuRecommendationReportPaths : response.skuRecommendationReportPaths;
			}

		} catch (error) {
			logError(TelemetryViews.SkuRecommendationWizard, 'GetSkuRecommendationFailed', error);

			this._skuRecommendationResults = {
				recommendations: this._skuRecommendationApiResponse,
				recommendationError: error
			};
		}		// Generating all the telemetry asynchronously as we don't need to block the user for it.
		this.generateSkuRecommendationTelemetry().catch(e => console.error(e));

		return this._skuRecommendationResults;
	}


	private async generateSkuRecommendationTelemetry(): Promise<void> {
		try {
			this._skuRecommendationResults?.recommendations?.sqlDbRecommendationResults
				.map((e, i) => [e, this._skuRecommendationResults?.recommendations?.elasticSqlDbRecommendationResults[i]])
				.forEach(resultPair => {
					// Send telemetry for recommended DB SKUs
					sendSqlMigrationActionEvent(
						TelemetryViews.SkuRecommendationWizard,
						TelemetryAction.GetDBSkuRecommendation,
						{
							'sessionId': this._sessionId,
							'recommendedSku': JSON.stringify(resultPair[0]?.targetSku),
							'elasticRecommendedSku': JSON.stringify(resultPair[1]?.targetSku),
							'recommendationDurationInMs': JSON.stringify(this._skuRecommendationResults?.recommendations?.sqlDbRecommendationDurationInMs),
							'elasticRecommendationDurationInMs': JSON.stringify(this._skuRecommendationResults?.recommendations?.elasticSqlDbRecommendationDurationInMs),
						},
						{}
					);
				});

			this._skuRecommendationResults?.recommendations?.sqlMiRecommendationResults
				.map((e, i) => [e, this._skuRecommendationResults?.recommendations?.elasticSqlMiRecommendationResults[i]])
				.forEach(resultPair => {
					// Send telemetry for recommended MI SKUs
					sendSqlMigrationActionEvent(
						TelemetryViews.SkuRecommendationWizard,
						TelemetryAction.GetMISkuRecommendation,
						{
							'sessionId': this._sessionId,
							'recommendedSku': JSON.stringify(resultPair[0]?.targetSku),
							'elasticRecommendedSku': JSON.stringify(resultPair[1]?.targetSku),
							'recommendationDurationInMs': JSON.stringify(this._skuRecommendationResults?.recommendations?.sqlMiRecommendationDurationInMs),
							'elasticRecommendationDurationInMs': JSON.stringify(this._skuRecommendationResults?.recommendations?.elasticSqlMiRecommendationDurationInMs),
						},
						{}
					);
				});

			this._skuRecommendationResults?.recommendations?.sqlVmRecommendationResults
				.map((e, i) => [e, this._skuRecommendationResults?.recommendations?.elasticSqlVmRecommendationResults[i]])
				.forEach(resultPair => {
					// Send telemetry for recommended VM SKUs
					sendSqlMigrationActionEvent(
						TelemetryViews.SkuRecommendationWizard,
						TelemetryAction.GetVMSkuRecommendation,
						{
							'sessionId': this._sessionId,
							'recommendedSku': JSON.stringify(resultPair[0]?.targetSku),
							'elasticRecommendedSku': JSON.stringify(resultPair[1]?.targetSku),
							'recommendationDurationInMs': JSON.stringify(this._skuRecommendationResults?.recommendations?.sqlVmRecommendationDurationInMs),
							'elasticRecommendationDurationInMs': JSON.stringify(this._skuRecommendationResults?.recommendations?.elasticSqlVmRecommendationDurationInMs),
						},
						{}
					);
				});

			// Send Instance requirements used for calculating recommendations
			sendSqlMigrationActionEvent(
				TelemetryViews.SkuRecommendationWizard,
				TelemetryAction.GetInstanceRequirements,
				{
					'sessionId': this._sessionId,
					'performanceDataSource': this._skuRecommendationPerformanceDataSource,
					'scalingFactor': this._skuScalingFactor?.toString(),
					'targetPercentile': this._skuTargetPercentile?.toString(),
					'enablePreviewSkus': this._skuEnablePreview?.toString(),
					'databaseLevelRequirements': JSON.stringify(this._skuRecommendationResults?.recommendations?.instanceRequirements?.databaseLevelRequirements?.map(i => {
						return {
							cpuRequirementInCores: i.cpuRequirementInCores,
							dataIOPSRequirement: i.dataIOPSRequirement,
							logIOPSRequirement: i.logIOPSRequirement,
							ioLatencyRequirementInMs: i.ioLatencyRequirementInMs,
							ioThroughputRequirementInMBps: i.ioThroughputRequirementInMBps,
							dataStorageRequirementInMB: i.dataStorageRequirementInMB,
							logStorageRequirementInMB: i.logStorageRequirementInMB,
							databaseName: hashString(i.databaseName),
							memoryRequirementInMB: i.memoryRequirementInMB,
							cpuRequirementInPercentageOfTotalInstance: i.cpuRequirementInPercentageOfTotalInstance,
							numberOfDataPointsAnalyzed: i.numberOfDataPointsAnalyzed,
							fileLevelRequirements: i.fileLevelRequirements?.map(file => {
								return {
									fileType: file.fileType,
									sizeInMB: file.sizeInMB,
									readLatencyInMs: file.readLatencyInMs,
									writeLatencyInMs: file.writeLatencyInMs,
									iopsRequirement: file.iopsRequirement,
									ioThroughputRequirementInMBps: file.ioThroughputRequirementInMBps,
									numberOfDataPointsAnalyzed: file.numberOfDataPointsAnalyzed
								};
							})
						};
					}))
				},
				{
					'cpuRequirementInCores': this._skuRecommendationResults?.recommendations?.instanceRequirements?.cpuRequirementInCores!,
					'dataStorageRequirementInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.dataStorageRequirementInMB!,
					'logStorageRequirementInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.logStorageRequirementInMB!,
					'memoryRequirementInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.memoryRequirementInMB!,
					'dataIOPSRequirement': this._skuRecommendationResults?.recommendations?.instanceRequirements?.dataIOPSRequirement!,
					'logIOPSRequirement': this._skuRecommendationResults?.recommendations?.instanceRequirements?.logIOPSRequirement!,
					'ioLatencyRequirementInMs': this._skuRecommendationResults?.recommendations?.instanceRequirements?.ioLatencyRequirementInMs!,
					'ioThroughputRequirementInMBps': this._skuRecommendationResults?.recommendations?.instanceRequirements?.ioThroughputRequirementInMBps!,
					'tempDBSizeInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.tempDBSizeInMB!,
					'aggregationTargetPercentile': this._skuRecommendationResults?.recommendations?.instanceRequirements?.aggregationTargetPercentile!,
					'numberOfDataPointsAnalyzed': this._skuRecommendationResults?.recommendations?.instanceRequirements?.numberOfDataPointsAnalyzed!,
				}
			);

		} catch (e) {
			logError(TelemetryViews.SkuRecommendationWizard, 'GetSkuRecommendationTelemetryFailed', e);
		}
	}

	public async startPerfDataCollection(
		dataFolder: string,
		perfQueryIntervalInSec: number,
		staticQueryIntervalInSec: number,
		numberOfIterations: number,
		page: SKURecommendationPage): Promise<boolean> {
		try {
			if (!this.performanceCollectionInProgress()) {
				const connectionString = await getSourceConnectionString();
				const response = await this.migrationService.startPerfDataCollection(
					connectionString,
					dataFolder,
					perfQueryIntervalInSec,
					staticQueryIntervalInSec,
					numberOfIterations);

				this._startPerfDataCollectionApiResponse = response!;
				this._perfDataCollectionStartDate = this._startPerfDataCollectionApiResponse.dateTimeStarted;
				this._perfDataCollectionStopDate = undefined;

				void vscode.window.showInformationMessage(constants.AZURE_RECOMMENDATION_START_POPUP);

				await this.startSkuTimers(page);
			}
		}
		catch (error) {
			console.log(error);
		}

		// Generate telemetry for start data collection request
		this.generateStartDataCollectionTelemetry().catch(e => console.error(e));

		return true;
	}

	private async generateStartDataCollectionTelemetry(): Promise<void> {
		try {
			sendSqlMigrationActionEvent(
				TelemetryViews.DataCollectionWizard,
				TelemetryAction.StartDataCollection,
				{
					'sessionId': this._sessionId,
					'timeDataCollectionStarted': this._perfDataCollectionStartDate?.toString() || ''
				},
				{});

		} catch (e) {
			logError(TelemetryViews.DataCollectionWizard, 'StartDataCollectionTelemetryFailed', e);
		}
	}

	public async startSkuTimers(page: SKURecommendationPage): Promise<void> {
		const classVariable = this;

		if (!this._autoRefreshPerfDataCollectionHandle) {
			clearInterval(this._autoRefreshPerfDataCollectionHandle);
			if (this.refreshPerfDataCollectionFrequency !== -1) {
				this._autoRefreshPerfDataCollectionHandle = setInterval(
					async function () {
						await classVariable.refreshPerfDataCollection();
						if (await classVariable.isWaitingForFirstTimeRefresh()) {
							await page.refreshSkuRecommendationComponents();	// update timer
						}
					},
					this.refreshPerfDataCollectionFrequency);
			}
		}

		if (!this._autoRefreshGetSkuRecommendationHandle) {
			// start one-time timer to get SKU recommendation
			clearTimeout(this._autoRefreshGetSkuRecommendationHandle);
			if (this.refreshGetSkuRecommendationFrequency !== -1) {
				this._autoRefreshGetSkuRecommendationHandle = setTimeout(
					async function () {
						await page.refreshAzureRecommendation();
					},
					this.refreshGetSkuRecommendationFrequency);
			}
		}
	}

	public async stopPerfDataCollection(): Promise<boolean> {
		try {
			const response = await this.migrationService.stopPerfDataCollection();
			void vscode.window.showInformationMessage(constants.AZURE_RECOMMENDATION_STOP_POPUP);

			this._stopPerfDataCollectionApiResponse = response!;
			this._perfDataCollectionStopDate = this._stopPerfDataCollectionApiResponse.dateTimeStopped;

			// stop auto refresh
			clearInterval(this._autoRefreshPerfDataCollectionHandle);
			clearInterval(this._autoRefreshGetSkuRecommendationHandle);
		}
		catch (error) {
			logError(TelemetryViews.DataCollectionWizard, 'StopDataCollectionFailed', error);
		}

		// Generate telemetry for stop data collection request
		this.generateStopDataCollectionTelemetry()
			.catch(e => console.error(e));
		return true;
	}

	private async generateStopDataCollectionTelemetry(): Promise<void> {
		try {
			sendSqlMigrationActionEvent(
				TelemetryViews.DataCollectionWizard,
				TelemetryAction.StopDataCollection,
				{
					'sessionId': this._sessionId,
					'timeDataCollectionStopped': this._perfDataCollectionStopDate?.toString() || ''
				},
				{});

		} catch (e) {
			logError(TelemetryViews.DataCollectionWizard, 'StopDataCollectionTelemetryFailed', e);
		}
	}

	public async refreshPerfDataCollection(): Promise<boolean> {
		try {
			const response = await this.migrationService.refreshPerfDataCollection(this._perfDataCollectionLastRefreshedDate ?? new Date());
			this._refreshPerfDataCollectionApiResponse = response!;
			this._perfDataCollectionLastRefreshedDate = this._refreshPerfDataCollectionApiResponse.refreshTime;
			this._perfDataCollectionMessages = this._refreshPerfDataCollectionApiResponse.messages;
			this._perfDataCollectionErrors = this._refreshPerfDataCollectionApiResponse.errors;
			this._perfDataCollectionIsCollecting = this._refreshPerfDataCollectionApiResponse.isCollecting;

			if (this._perfDataCollectionErrors?.length > 0) {
				void vscode.window.showInformationMessage(
					constants.PERF_DATA_COLLECTION_ERROR(
						this._assessmentApiResponse?.assessmentResult?.name,
						this._perfDataCollectionErrors));
			}
		}
		catch (error) {
			console.log(error);		// use console.log() instead of logError() to avoid spamming telemetry with this error, which can be frequent
		}

		return true;
	}

	public async isWaitingForFirstTimeRefresh(): Promise<boolean> {
		const elapsedTimeInMins = Math.abs(new Date().getTime() - new Date(this._perfDataCollectionStartDate!).getTime()) / constants.TIME_IN_MINUTES(1);
		const skuRecAutoRefreshTimeInMins = this.refreshGetSkuRecommendationFrequency / constants.TIME_IN_MINUTES(1);

		return elapsedTimeInMins < skuRecAutoRefreshTimeInMins;
	}

	public performanceCollectionNotStarted(): boolean {
		return !this._perfDataCollectionStartDate
			&& !this._perfDataCollectionStopDate;
	}

	public performanceCollectionInProgress(): boolean {
		return this._perfDataCollectionStartDate !== undefined
			&& this._perfDataCollectionStopDate === undefined;
	}

	public performanceCollectionStopped(): boolean {
		return this._perfDataCollectionStartDate !== undefined
			&& this._perfDataCollectionStopDate !== undefined;
	}

	private async generateAssessmentTelemetry(): Promise<void> {
		try {

			const serverIssues = this._assessmentResults?.issues.map(i => {
				return {
					ruleId: i.ruleId,
					count: i.impactedObjects.length
				};
			});

			const serverAssessmentErrorsMap: Map<number, number> = new Map();
			this._assessmentApiResponse?.assessmentResult?.errors?.forEach(e => {
				serverAssessmentErrorsMap.set(
					e.errorId,
					serverAssessmentErrorsMap.get(e.errorId) ?? 0 + 1);
			});

			const serverErrors: { errorId: number, count: number }[] = [];
			serverAssessmentErrorsMap.forEach(
				(v, k) => serverErrors.push(
					{ errorId: k, count: v }));

			const startTime = new Date(this._assessmentApiResponse?.startTime);
			const endTime = new Date(this._assessmentApiResponse?.endedTime);

			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationWizardTargetSelectionPage,
				TelemetryAction.ServerAssessment,
				{
					'sessionId': this._sessionId,
					'hashedServerName': hashString(this._assessmentApiResponse?.assessmentResult?.name),
					'startTime': startTime.toString(),
					'endTime': endTime.toString(),
					'serverVersion': this._assessmentApiResponse?.assessmentResult?.serverVersion,
					'serverEdition': this._assessmentApiResponse?.assessmentResult?.serverEdition,
					'platform': this._assessmentApiResponse?.assessmentResult?.serverHostPlatform,
					'engineEdition': this._assessmentApiResponse?.assessmentResult?.serverEngineEdition,
					'serverIssues': JSON.stringify(serverIssues),
					'serverErrors': JSON.stringify(serverErrors),
				},
				{
					'issuesCount': this._assessmentResults?.issues.length,
					'warningsCount': this._assessmentResults?.databaseAssessments.reduce((count, d) => count + d.issues.length, 0),
					'durationInMilliseconds': endTime.getTime() - startTime.getTime(),
					'databaseCount': this._assessmentResults?.databaseAssessments.length,
					'serverHostCpuCount': this._assessmentApiResponse?.assessmentResult?.cpuCoreCount,
					'serverHostPhysicalMemoryInBytes': this._assessmentApiResponse?.assessmentResult?.physicalServerMemory,
					'serverDatabases': this._assessmentApiResponse?.assessmentResult?.numberOfUserDatabases,
					'serverDatabasesReadyForMigration': this._assessmentApiResponse?.assessmentResult?.sqlManagedInstanceTargetReadiness?.numberOfDatabasesReadyForMigration,
					'offlineDatabases': this._assessmentApiResponse?.assessmentResult?.sqlManagedInstanceTargetReadiness?.numberOfNonOnlineDatabases,
				}
			);

			const databaseWarningsMap: Map<string, number> = new Map();
			const databaseErrorsMap: Map<number, number> = new Map();

			this._assessmentApiResponse?.assessmentResult?.databases.forEach(d => {

				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationWizardTargetSelectionPage,
					TelemetryAction.DatabaseAssessment,
					{
						'sessionId': this._sessionId,
						'hashedDatabaseName': hashString(d.name),
						'compatibilityLevel': d.compatibilityLevel
					},
					{
						'warningsCount': d.items.length,
						'errorsCount': d.errors.length,
						'assessmentTimeMs': d.assessmentTimeInMilliseconds,
						'numberOfBlockerIssues': d.sqlManagedInstanceTargetReadiness.numOfBlockerIssues,
						'databaseSizeInMb': d.databaseSize
					});

				d.items.forEach(i => {
					databaseWarningsMap.set(
						i.ruleId,
						databaseWarningsMap.get(i.ruleId) ?? 0 + i.impactedObjects.length);
				});

				d.errors.forEach(
					e => databaseErrorsMap.set(
						e.errorId,
						databaseErrorsMap.get(e.errorId) ?? 0 + 1));

			});

			const databaseWarnings: { warningId: string, count: number }[] = [];

			databaseWarningsMap.forEach(
				(v, k) => databaseWarnings.push(
					{ warningId: k, count: v }));

			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationWizardTargetSelectionPage,
				TelemetryAction.DatabaseAssessmentWarning,
				{
					'sessionId': this._sessionId,
					'warnings': JSON.stringify(databaseWarnings)
				},
				{});

			const databaseErrors: { errorId: number, count: number }[] = [];
			databaseErrorsMap.forEach(
				(v, k) => databaseErrors.push(
					{ errorId: k, count: v }));

			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationWizardTargetSelectionPage,
				TelemetryAction.DatabaseAssessmentError,
				{
					'sessionId': this._sessionId,
					'errors': JSON.stringify(databaseErrors)
				},
				{});

		} catch (e) {
			console.log('error during assessment telemetry:');
			console.log(e);
		}
	}

	public get gatheringInformationError(): string | undefined {
		return this._gatheringInformationError;
	}

	public set gatheringInformationError(error: string | undefined) {
		this._gatheringInformationError = error;
	}

	public get stateChangeEvent(): vscode.Event<StateChangeEvent> {
		return this._stateChangeEventEmitter.event;
	}

	dispose() {
		this._stateChangeEventEmitter.dispose();
	}

	public getExtensionPath(): string {
		return this.extensionContext.extensionPath;
	}

	public async getManagedDatabases(): Promise<string[]> {
		return (
			await getSqlManagedInstanceDatabases(this._azureAccount,
				this._targetSubscription,
				<SqlManagedInstance>this._targetServerInstance)
		).map(t => t.name);
	}

	public async startTdeMigration(
		accessToken: string,
		reportUpdate: (dbName: string, succeeded: boolean, message: string, statusCode: string) => Promise<void>): Promise<OperationResult<TdeMigrationDbResult[]>> {

		const tdeEnabledDatabases = this.tdeMigrationConfig.getTdeEnabledDatabases();
		const connectionString = await getSourceConnectionString();

		const opResult: OperationResult<TdeMigrationDbResult[]> = {
			success: false,
			result: [],
			errors: []
		};

		try {

			const migrationResult = await this.migrationService.migrateCertificate(
				tdeEnabledDatabases,
				connectionString,
				this._targetSubscription?.id,
				this._resourceGroup?.name,
				this._targetServerInstance.name,
				this.tdeMigrationConfig.getAppliedNetworkPath(),
				accessToken,
				reportUpdate);

			opResult.errors = migrationResult!.migrationStatuses
				.filter(entry => !entry.success)
				.map(entry => constants.TDE_MIGRATION_ERROR_DB(entry.dbName, entry.message));

			opResult.result = migrationResult!.migrationStatuses.map(m => ({
				name: m.dbName,
				success: m.success,
				message: m.message
			}));

		} catch (e) {
			opResult.errors = [constants.TDE_MIGRATION_ERROR(e.message)];

			opResult.result = tdeEnabledDatabases.map(m => ({
				name: m,
				success: false,
				message: e.message
			}));
		}

		opResult.success = opResult.errors.length === 0; //Set success when there are no errors.
		return opResult;
	}

	public async getTdeValidationTitles(): Promise<OperationResult<string[]>> {
		const opResult: OperationResult<string[]> = {
			success: false,
			result: [],
			errors: []
		};

		try {
			opResult.result = await this.migrationService.getTdeValidationTitles() ?? [];
		} catch (e) {
			console.error(e);
		}

		return opResult;
	}

	public async runTdeValidation(networkSharePath: string): Promise<OperationResult<TdeValidationResult[]>> {
		const opResult: OperationResult<TdeValidationResult[]> = {
			success: false,
			result: [],
			errors: []
		};

		const connectionString = await getSourceConnectionString();

		try {
			let tdeValidationResult = await this.migrationService.runTdeValidation(
				connectionString,
				networkSharePath);

			if (tdeValidationResult !== undefined) {
				opResult.result = tdeValidationResult?.map((e) => {
					return {
						validationTitle: e.validationTitle,
						validationDescription: e.validationDescription,
						validationTroubleshootingTips: e.validationTroubleshootingTips,
						validationErrorMessage: e.validationErrorMessage,
						validationStatus: e.validationStatus,
						validationStatusString: e.validationStatusString
					};
				});
			}
		} catch (e) {
			console.error(e);
		}

		return opResult;
	}

	public async startMigration() {
		const currentConnection = await getSourceConnectionProfile();
		const isOfflineMigration = this._databaseBackup.migrationMode === MigrationMode.OFFLINE;
		const isSqlDbTarget = this.isSqlDbTarget;

		const requestBody: StartDatabaseMigrationRequest = {
			location: this._sqlMigrationService?.location!,
			properties: {
				sourceDatabaseName: '',
				migrationService: this._sqlMigrationService?.id!,
				backupConfiguration: {},
				sourceSqlConnection: {
					dataSource: currentConnection?.serverName!,
					authentication: this._authenticationType,
					userName: this._sqlServerUsername,
					password: this._sqlServerPassword,
					encryptConnection: getEncryptConnectionValue(currentConnection),
					trustServerCertificate: getTrustServerCertificateValue(currentConnection)
				},
				scope: this._targetServerInstance.id,
				offlineConfiguration: {
					offline: isOfflineMigration
				}
			}
		};

		for (let i = 0; i < this._databasesForMigration.length; i++) {
			try {
				if (isSqlDbTarget) {
					const sourceDatabaseName = this._databasesForMigration[i];
					const targetDatabaseInfo = this._sourceTargetMapping.get(sourceDatabaseName);
					const totalTables = targetDatabaseInfo?.sourceTables.size ?? 0;
					// skip databases that don't have tables
					if (totalTables === 0) {
						continue;
					}

					const sourceTables: string[] = [];
					let selectedTables = 0;
					targetDatabaseInfo?.sourceTables.forEach(sourceTableInfo => {
						if (sourceTableInfo.selectedForMigration) {
							selectedTables++;
							sourceTables.push(sourceTableInfo.tableName);
						}
					});

					// skip databases that don't have tables selected
					if (selectedTables === 0 && !targetDatabaseInfo?.enableSchemaMigration) {
						continue;
					}

					const sqlDbTarget = this._targetServerInstance as AzureSqlDatabaseServer;
					requestBody.properties.offlineConfiguration = undefined;
					requestBody.properties.sourceSqlConnection = {
						dataSource: currentConnection?.serverName!,
						authentication: this._authenticationType,
						userName: this._sqlServerUsername,
						password: this._sqlServerPassword,
						encryptConnection: getEncryptConnectionValue(currentConnection),
						trustServerCertificate: getTrustServerCertificateValue(currentConnection)
					};
					requestBody.properties.targetSqlConnection = {
						dataSource: sqlDbTarget.properties.fullyQualifiedDomainName,
						authentication: MigrationSourceAuthenticationType.Sql,
						userName: this._targetUserName,
						password: this._targetPassword,
						// when connecting to a target Azure SQL DB, use true/false
						encryptConnection: true,
						trustServerCertificate: false,
					};

					// Schema + data configuration
					requestBody.properties.sqlSchemaMigrationConfiguration = {
						enableSchemaMigration: targetDatabaseInfo?.enableSchemaMigration ?? false
					};

					requestBody.properties.sqlDataMigrationConfiguration = {
						enableDataMigration: selectedTables > 0
					};

					// send an empty array when 'all' tables are selected for migration
					requestBody.properties.tableList = selectedTables === totalTables
						? []
						: sourceTables;
				} else {
					switch (this._databaseBackup.networkContainerType) {
						case NetworkContainerType.BLOB_CONTAINER:
							requestBody.properties.backupConfiguration = {
								targetLocation: undefined!,
								sourceLocation: {
									fileStorageType: FileStorageType.AzureBlob,
									azureBlob: {
										storageAccountResourceId: this._databaseBackup.blobs[i].storageAccount.id,
										accountKey: this._databaseBackup.blobs[i].storageKey,
										blobContainerName: getBlobContainerNameWithFolder(this._databaseBackup.blobs[i], isOfflineMigration)
									}
								}
							};

							if (isOfflineMigration) {
								requestBody.properties.offlineConfiguration = {
									offline: isOfflineMigration,
									lastBackupName: getLastBackupFileNameWithoutFolder(this._databaseBackup.blobs[i])
								};
							}
							break;
						case NetworkContainerType.NETWORK_SHARE:
							requestBody.properties.backupConfiguration = {
								targetLocation: {
									storageAccountResourceId: this._databaseBackup.networkShares[i].storageAccount.id,
									accountKey: this._databaseBackup.networkShares[i].storageKey,
								},
								sourceLocation: {
									fileStorageType: FileStorageType.FileShare,
									fileShare: {
										path: this._databaseBackup.networkShares[i].networkShareLocation,
										username: this._databaseBackup.networkShares[i].windowsUser,
										password: this._databaseBackup.networkShares[i].password,
									}
								}
							};
							break;
					}
				}

				requestBody.properties.sourceDatabaseName = this._databasesForMigration[i];
				const response = await startDatabaseMigration(
					this._azureAccount,
					this._sqlMigrationServiceSubscription,
					this._sqlMigrationService?.location!,
					this._targetServerInstance,
					this._targetDatabaseNames[i],
					requestBody,
					this._sessionId);

				response.databaseMigration.properties.sourceDatabaseName = this._databasesForMigration[i];
				response.databaseMigration.properties.backupConfiguration = requestBody.properties.backupConfiguration!;
				response.databaseMigration.properties.offlineConfiguration = requestBody.properties.offlineConfiguration!;
				response.databaseMigration.properties.sqlSchemaMigrationConfiguration = requestBody.properties.sqlSchemaMigrationConfiguration!;
				response.databaseMigration.properties.sqlDataMigrationConfiguration = requestBody.properties.sqlDataMigrationConfiguration!;

				let wizardEntryPoint = WizardEntryPoint.Default;
				if (this.resumeAssessment) {
					wizardEntryPoint = WizardEntryPoint.SaveAndClose;
				} else if (this.restartMigration) {
					wizardEntryPoint = WizardEntryPoint.RestartMigration;
				}
				if (response.status === 201 || response.status === 200) {
					sendSqlMigrationActionEvent(
						TelemetryViews.MigrationWizardSummaryPage,
						TelemetryAction.StartMigration,
						{
							'sessionId': this._sessionId,
							'tenantId': this._azureTenant?.id,
							'subscriptionId': this._sqlMigrationServiceSubscription?.id,
							'resourceGroup': this._sqlMigrationServiceResourceGroup?.name,
							'location': this._location.name,
							'targetType': this._targetType,
							'hashedServerName': hashString(this._assessmentApiResponse?.assessmentResult?.name),
							'hashedDatabaseName': hashString(this._databasesForMigration[i]),
							'migrationMode': isOfflineMigration ? 'offline' : 'online',
							'migrationStartTime': new Date().toString(),
							'targetDatabaseName': this._targetDatabaseNames[i],
							'serverName': this._targetServerInstance.name,
							'sqlMigrationServiceId': Buffer.from(this._sqlMigrationService?.id!).toString('base64'),
							'irRegistered': (this._nodeNames?.length > 0).toString(),
							'wizardEntryPoint': wizardEntryPoint,
						},
						{
						});

					void vscode.window.showInformationMessage(
						localize(
							"sql.migration.starting.migration.message",
							'Starting migration for database {0} to {1} - {2}',
							this._databasesForMigration[i],
							this._targetServerInstance.name,
							this._targetDatabaseNames[i]));
				}
			} catch (e) {
				void vscode.window.showErrorMessage(
					localize(
						'sql.migration.starting.migration.error',
						"An error occurred while starting the migration: '{0}'",
						e.message));
				logError(TelemetryViews.MigrationLocalStorage, 'StartMigrationFailed', e);
			}
			finally {
				// kill existing data collection if user start migration
				await this.refreshPerfDataCollection();
				if ((!this.resumeAssessment || this.restartMigration) && this._perfDataCollectionIsCollecting) {
					void this.stopPerfDataCollection();
					void vscode.window.showInformationMessage(
						constants.AZURE_RECOMMENDATION_STOP_POPUP);
				}
			}
		}
	}

	public async saveInfo(serverName: string, currentPage: Page): Promise<void> {
		const saveInfo: SavedInfo = {
			closedPage: currentPage,
			databaseAssessment: [],
			databaseList: [],
			databaseInfoList: [],
			migrationTargetType: null,
			azureAccount: null,
			azureTenant: null,
			subscription: null,
			location: null,
			resourceGroup: null,
			targetServerInstance: null,
			migrationMode: null,
			networkContainerType: null,
			networkShares: [],
			blobs: [],
			targetDatabaseNames: [],
			sqlMigrationService: undefined,
			serverAssessment: null,
			xEventsFilesFolderPath: null,
			skuRecommendation: null,
			serviceResourceGroup: null,
			serviceSubscription: null,
		};
		switch (currentPage) {
			case Page.Summary:

			case Page.IntegrationRuntime:
				saveInfo.sqlMigrationService = this._sqlMigrationService;
				saveInfo.serviceSubscription = this._sqlMigrationServiceSubscription;
				saveInfo.serviceResourceGroup = this._sqlMigrationServiceResourceGroup;
				saveInfo.migrationMode = this._databaseBackup.migrationMode;
				saveInfo.networkContainerType = this._databaseBackup.networkContainerType;

			case Page.DatabaseBackup:
				saveInfo.networkShares = this._databaseBackup.networkShares;
				saveInfo.blobs = this._databaseBackup.blobs;
				saveInfo.targetDatabaseNames = this._targetDatabaseNames;

			case Page.TargetSelection:
				saveInfo.azureAccount = deepClone(this._azureAccount);
				saveInfo.azureTenant = deepClone(this._azureTenant);
				saveInfo.subscription = this._targetSubscription;
				saveInfo.location = this._location;
				saveInfo.resourceGroup = this._resourceGroup;
				saveInfo.targetServerInstance = this._targetServerInstance;

			case Page.SKURecommendation:
				saveInfo.migrationTargetType = this._targetType;
				saveInfo.databaseList = this._databasesForMigration;
				saveInfo.serverAssessment = this._assessmentResults;
				saveInfo.xEventsFilesFolderPath = this._xEventsFilesFolderPath;

				if (this._skuRecommendationPerformanceDataSource) {
					const skuRecommendation: SkuRecommendationSavedInfo = {
						skuRecommendationPerformanceDataSource: this._skuRecommendationPerformanceDataSource,
						skuRecommendationPerformanceLocation: this._skuRecommendationPerformanceLocation,
						perfDataCollectionStartDate: this._perfDataCollectionStartDate,
						perfDataCollectionStopDate: this._perfDataCollectionStopDate,
						skuTargetPercentile: this._skuTargetPercentile,
						skuScalingFactor: this._skuScalingFactor,
						skuEnablePreview: this._skuEnablePreview,
					};
					saveInfo.skuRecommendation = skuRecommendation;
				}

			case Page.DatabaseSelector:
				saveInfo.databaseAssessment = this._databasesForAssessment;
				saveInfo.xEventsFilesFolderPath = this._xEventsFilesFolderPath;
				await this.extensionContext.globalState.update(`${this.mementoString}.${serverName}`, saveInfo);
		}
	}
	public async loadSavedInfo(): Promise<Boolean> {
		try {
			this._targetType = this.savedInfo.migrationTargetType || undefined!;

			this._databasesForAssessment = this.savedInfo.databaseAssessment;
			this._databasesForMigration = this.savedInfo.databaseList;
			this._didUpdateDatabasesForMigration = true;
			this._didDatabaseMappingChange = true;
			this.refreshDatabaseBackupPage = true;

			switch (this._targetType) {
				case MigrationTargetType.SQLMI:
					this._miDbs = this._databasesForMigration;
					break;
				case MigrationTargetType.SQLVM:
					this._vmDbs = this._databasesForMigration;
					break;
				case MigrationTargetType.SQLDB:
					this._sqldbDbs = this._databasesForMigration;
					break;
			}

			this._azureAccount = this.savedInfo.azureAccount || undefined!;
			this._azureTenant = this.savedInfo.azureTenant || undefined!;

			this._targetSubscription = this.savedInfo.subscription || undefined!;
			this._location = this.savedInfo.location || undefined!;
			this._resourceGroup = this.savedInfo.resourceGroup || undefined!;
			this._targetServerInstance = this.savedInfo.targetServerInstance || undefined!;

			this._databaseBackup.migrationMode = this.savedInfo.migrationMode || undefined!;

			this._sourceDatabaseNames = this._databasesForMigration;
			this._targetDatabaseNames = this.savedInfo.targetDatabaseNames;
			this._databaseBackup.networkContainerType = this.savedInfo.networkContainerType ?? NetworkContainerType.BLOB_CONTAINER;
			this._databaseBackup.networkShares = this.savedInfo.networkShares;
			this._databaseBackup.blobs = this.savedInfo.blobs;
			this._databaseBackup.subscription = this.savedInfo.subscription || undefined!;

			this._sqlMigrationService = this.savedInfo.sqlMigrationService;
			this._sqlMigrationServiceSubscription = this.savedInfo.serviceSubscription || undefined!;
			this._sqlMigrationServiceResourceGroup = this.savedInfo.serviceResourceGroup || undefined!;

			this._assessedDatabaseList = this.savedInfo.databaseAssessment ?? [];
			this._databasesForAssessment = this.savedInfo.databaseAssessment ?? [];
			this._xEventsFilesFolderPath = this.savedInfo.xEventsFilesFolderPath ?? '';
			const savedAssessmentResults = this.savedInfo.serverAssessment;
			if (savedAssessmentResults) {
				this._assessmentResults = savedAssessmentResults;
				this._assessedDatabaseList = this.savedInfo.databaseAssessment;
			}

			const savedSkuRecommendation = this.savedInfo.skuRecommendation;
			if (savedSkuRecommendation) {
				this._skuRecommendationPerformanceDataSource = savedSkuRecommendation.skuRecommendationPerformanceDataSource;
				this._skuRecommendationPerformanceLocation = savedSkuRecommendation.skuRecommendationPerformanceLocation;
				this._perfDataCollectionStartDate = savedSkuRecommendation.perfDataCollectionStartDate;
				this._perfDataCollectionStopDate = savedSkuRecommendation.perfDataCollectionStopDate;
				this._skuTargetPercentile = savedSkuRecommendation.skuTargetPercentile;
				this._skuScalingFactor = savedSkuRecommendation.skuScalingFactor;
				this._skuEnablePreview = savedSkuRecommendation.skuEnablePreview;
			}
			return true;
		} catch {
			return false;
		}


	}

	public GetTargetType(): string {
		switch (this._targetType) {
			case MigrationTargetType.SQLMI:
				return constants.LOGIN_MIGRATIONS_MI_TEXT;
			case MigrationTargetType.SQLVM:
				return constants.LOGIN_MIGRATIONS_VM_TEXT;
			case MigrationTargetType.SQLDB:
				return constants.LOGIN_MIGRATIONS_DB_TEXT;
		}
		return "";
	}

	public get isWindowsAuthMigrationSupported(): boolean {
		return this._targetType === MigrationTargetType.SQLMI;
	}

	/**
	 * The function sets the MI target server name
	 */
	private setMiTargetServerName(): void {
		// Public endpoint format : <mi_name>.public.<dns_zone>.database.windows.net
		// Private endpoint format : <mi_name>.<dns-zone>.database.windows.net
		const sqlMi = this._targetServerInstance as SqlManagedInstance;
		const sqlMiName = sqlMi.name;
		const sqlMiPublicEndpointIdentifier = sqlMi.properties.publicDataEndpointEnabled ? ".public" : "";
		const sqlMiDnsZone = sqlMi.properties.dnsZone;
		this._targetServerName = sqlMiName + sqlMiPublicEndpointIdentifier + "." +
			sqlMiDnsZone + "." + this._sqlMiEndpointSuffix;
	}

	public setTargetServerName(): void {
		switch (this._targetType) {
			case MigrationTargetType.SQLMI:
				this.setMiTargetServerName();
				break;
			case MigrationTargetType.SQLDB:
				const sqlDb = this._targetServerInstance as AzureSqlDatabaseServer;
				this._targetServerName = sqlDb.properties.fullyQualifiedDomainName;
				break;
			case MigrationTargetType.SQLVM:
				// For sqlvm, we need to use ip address from the network interface to connect to the server
				const sqlVm = this._targetServerInstance as SqlVMServer;
				const networkInterfaces = Array.from(sqlVm.networkInterfaces.values());
				this._targetServerName = NetworkInterfaceModel.getIpAddress(networkInterfaces);
				break;
		}
	}

	public get targetServerName(): string {
		// If the target server name is not already set, return it
		if (!this._targetServerName) {
			this.setTargetServerName();
		}

		return this._targetServerName;
	}
}

export interface ServerAssessment {
	issues: contracts.SqlMigrationAssessmentResultItem[];
	databaseAssessments: {
		name: string;
		issues: contracts.SqlMigrationAssessmentResultItem[];
		errors?: contracts.ErrorModel[];
	}[];
	errors?: contracts.ErrorModel[];
	assessmentError?: Error;
}

export interface SkuRecommendation {
	recommendations?: contracts.SkuRecommendationResult;
	recommendationError?: Error;
}

export interface OperationResult<T> {
	success: boolean;
	result: T;
	errors: string[];
}
