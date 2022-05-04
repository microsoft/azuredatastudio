/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { SqlMigrationService, SqlManagedInstance, startDatabaseMigration, StartDatabaseMigrationRequest, StorageAccount, SqlVMServer, getLocationDisplayName, getSqlManagedInstanceDatabases } from '../api/azure';
import * as constants from '../constants/strings';
import * as nls from 'vscode-nls';
import { v4 as uuidv4 } from 'uuid';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews, logError } from '../telemtery';
import { hashString, deepClone } from '../api/utils';
import { SKURecommendationPage } from '../wizard/skuRecommendationPage';
const localize = nls.loadMessageBundle();

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

export enum MigrationTargetType {
	SQLVM = 'AzureSqlVirtualMachine',
	SQLMI = 'AzureSqlManagedInstance',
	SQLDB = 'AzureSqlDatabase'
}

export enum MigrationSourceAuthenticationType {
	Integrated = 'WindowsAuthentication',
	Sql = 'SqlAuthentication'
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
	DatabaseSelector,
	SKURecommendation,
	TargetSelection,
	MigrationMode,
	DatabaseBackup,
	IntegrationRuntime,
	Summary
}

export enum WizardEntryPoint {
	Default = 'Default',
	SaveAndClose = 'SaveAndClose',
	RetryMigration = 'RetryMigration',
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

export interface Blob {
	resourceGroup: azurecore.azureResource.AzureResourceResourceGroup;
	storageAccount: StorageAccount;
	blobContainer: azurecore.azureResource.BlobContainer;
	storageKey: string;
	lastBackupFile?: string; // _todo: does it make sense to store the last backup file here?
}

export interface Model {
	readonly sourceConnectionId: string;
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
	migrationTargetType: MigrationTargetType | null;
	azureAccount: azdata.Account | null;
	azureTenant: azurecore.Tenant | null;
	subscription: azurecore.azureResource.AzureResourceSubscription | null;
	location: azurecore.azureResource.AzureLocation | null;
	resourceGroup: azurecore.azureResource.AzureResourceResourceGroup | null;
	targetServerInstance: azurecore.azureResource.AzureSqlManagedInstance | SqlVMServer | null;
	migrationMode: MigrationMode | null;
	networkContainerType: NetworkContainerType | null;
	networkShares: NetworkShare[];
	blobs: Blob[];
	targetDatabaseNames: string[];
	sqlMigrationService: SqlMigrationService | undefined;
	serverAssessment: ServerAssessment | null;
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
	public _targetServerInstance!: SqlManagedInstance | SqlVMServer;
	public _databaseBackup!: DatabaseBackupModel;
	public _storageAccounts!: StorageAccount[];
	public _fileShares!: azurecore.azureResource.FileShare[];
	public _blobContainers!: azurecore.azureResource.BlobContainer[];
	public _lastFileNames!: azurecore.azureResource.Blob[];
	public _sourceDatabaseNames!: string[];
	public _targetDatabaseNames!: string[];

	public _sqlMigrationServiceResourceGroup!: azurecore.azureResource.AzureResourceResourceGroup;
	public _sqlMigrationService!: SqlMigrationService | undefined;
	public _sqlMigrationServices!: SqlMigrationService[];
	public _nodeNames!: string[];

	private _stateChangeEventEmitter = new vscode.EventEmitter<StateChangeEvent>();
	private _currentState: State;
	private _gatheringInformationError: string | undefined;

	public _databasesForAssessment!: string[];
	public _assessmentResults!: ServerAssessment;
	public _assessedDatabaseList!: string[];
	public _runAssessments: boolean = true;
	private _assessmentApiResponse!: mssql.AssessmentResult;
	public mementoString: string;

	public _databasesForMigration: string[] = [];
	public _didUpdateDatabasesForMigration: boolean = false;
	public _vmDbs: string[] = [];
	public _miDbs: string[] = [];
	public _targetType!: MigrationTargetType;

	public _skuRecommendationResults!: SkuRecommendation;
	public _skuRecommendationPerformanceDataSource!: PerformanceDataSourceOptions;
	private _skuRecommendationApiResponse!: mssql.SkuRecommendationResult;
	public _skuRecommendationPerformanceLocation!: string;
	private _skuRecommendationRecommendedDatabaseList!: string[];
	private _startPerfDataCollectionApiResponse!: mssql.StartPerfDataCollectionResult;
	private _stopPerfDataCollectionApiResponse!: mssql.StopPerfDataCollectionResult;
	private _refreshPerfDataCollectionApiResponse!: mssql.RefreshPerfDataCollectionResult;
	public _perfDataCollectionStartDate!: Date | undefined;
	public _perfDataCollectionStopDate!: Date | undefined;
	public _perfDataCollectionLastRefreshedDate!: Date;
	public _perfDataCollectionMessages!: string[];
	public _perfDataCollectionErrors!: string[];
	public _perfDataCollectionIsCollecting!: boolean;

	public readonly _performanceDataQueryIntervalInSeconds = 30;
	public readonly _staticDataQueryIntervalInSeconds = 60;
	public readonly _numberOfPerformanceDataQueryIterations = 19;
	public readonly _defaultDataPointStartTime = '1900-01-01 00:00:00';
	public readonly _defaultDataPointEndTime = '2200-01-01 00:00:00';
	public readonly _recommendationTargetPlatforms = [MigrationTargetType.SQLDB, MigrationTargetType.SQLMI, MigrationTargetType.SQLVM];

	public refreshPerfDataCollectionFrequency = this._performanceDataQueryIntervalInSeconds * 1000;
	private _autoRefreshPerfDataCollectionHandle!: NodeJS.Timeout;
	public refreshGetSkuRecommendationFrequency = constants.TIME_IN_MINUTES(10);
	private _autoRefreshGetSkuRecommendationHandle!: NodeJS.Timeout;

	public _skuScalingFactor!: number;
	public _skuTargetPercentile!: number;
	public _skuEnablePreview!: boolean;

	public refreshDatabaseBackupPage!: boolean;
	public retryMigration!: boolean;
	public resumeAssessment!: boolean;
	public savedInfo!: SavedInfo;
	public closedPage!: number;
	public _sessionId: string = uuidv4();

	public excludeDbs: string[] = [
		'master',
		'tempdb',
		'msdb',
		'model'
	];
	public serverName!: string;

	constructor(
		public extensionContext: vscode.ExtensionContext,
		private readonly _sourceConnectionId: string,
		public readonly migrationService: mssql.ISqlMigrationService
	) {
		this._currentState = State.INIT;
		this._databaseBackup = {} as DatabaseBackupModel;
		this._databaseBackup.networkShares = [];
		this._databaseBackup.blobs = [];
		this._targetDatabaseNames = [];
		this.mementoString = 'sqlMigration.assessmentResults';

		this._skuScalingFactor = 100;
		this._skuTargetPercentile = 95;
		this._skuEnablePreview = true;
	}

	public get sourceConnectionId(): string {
		return this._sourceConnectionId;
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
		let temp = await azdata.connection.listDatabases(this.sourceConnectionId);
		let finalResult = temp.filter((name) => !this.excludeDbs.includes(name));
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

	public async getDatabaseAssessments(targetType: MigrationTargetType): Promise<ServerAssessment> {
		const ownerUri = await azdata.connection.getUriForConnection(this.sourceConnectionId);
		try {
			const response = (await this.migrationService.getAssessments(ownerUri, this._databasesForAssessment))!;
			this._assessmentApiResponse = response;
			this._assessedDatabaseList = this._databasesForAssessment.slice();

			if (response?.assessmentResult) {
				response.assessmentResult.items = response.assessmentResult.items?.filter(
					issue => issue.appliesToMigrationTargetPlatform === targetType);

				response.assessmentResult.databases?.forEach(
					database => database.items = database.items?.filter(
						issue => issue.appliesToMigrationTargetPlatform === targetType));
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
			const serverInfo = await azdata.connection.getServerInfo(this.sourceConnectionId);
			const machineName = (<any>serverInfo)['machineName'];	// contains the correct machine name but not necessarily the correct instance name
			const instanceName = (await this.getSourceConnectionProfile()).serverName;	// contains the correct instance name but not necessarily the correct machine name

			let fullInstanceName: string;
			if (instanceName.includes('\\')) {
				fullInstanceName = machineName + '\\' + instanceName.substring(instanceName.indexOf('\\') + 1);
			} else {
				fullInstanceName = machineName;
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

			if (response?.sqlDbRecommendationResults || response?.sqlMiRecommendationResults || response?.sqlVmRecommendationResults) {
				this._skuRecommendationResults = {
					recommendations: {
						sqlDbRecommendationResults: response?.sqlDbRecommendationResults ?? [],
						sqlMiRecommendationResults: response?.sqlMiRecommendationResults ?? [],
						sqlVmRecommendationResults: response?.sqlVmRecommendationResults ?? [],
						instanceRequirements: response?.instanceRequirements
					},
				};
			} else {
				this._skuRecommendationResults = {
					recommendations: {
						sqlDbRecommendationResults: [],
						sqlMiRecommendationResults: [],
						sqlVmRecommendationResults: [],
						instanceRequirements: response?.instanceRequirements
					},
				};
			}

		} catch (error) {
			logError(TelemetryViews.SkuRecommendationWizard, 'GetSkuRecommendationFailed', error);

			this._skuRecommendationResults = {
				recommendations: {
					sqlDbRecommendationResults: this._skuRecommendationApiResponse?.sqlDbRecommendationResults ?? [],
					sqlMiRecommendationResults: this._skuRecommendationApiResponse?.sqlMiRecommendationResults ?? [],
					sqlVmRecommendationResults: this._skuRecommendationApiResponse?.sqlVmRecommendationResults ?? [],
					instanceRequirements: this._skuRecommendationApiResponse?.instanceRequirements
				},
				recommendationError: error
			};
		}		// Generating all the telemetry asynchronously as we don't need to block the user for it.
		this.generateSkuRecommendationTelemetry().catch(e => console.error(e));

		return this._skuRecommendationResults;
	}

	private async generateSkuRecommendationTelemetry(): Promise<void> {
		try {

			this._skuRecommendationResults?.recommendations?.sqlMiRecommendationResults?.forEach(resultItem => {
				// Send telemetry for recommended MI SKU
				sendSqlMigrationActionEvent(
					TelemetryViews.SkuRecommendationWizard,
					TelemetryAction.GetMISkuRecommendation,
					{
						'sessionId': this._sessionId,
						'recommendedSku': JSON.stringify(resultItem?.targetSku)
					},
					{}
				);
			});

			this._skuRecommendationResults?.recommendations?.sqlVmRecommendationResults?.forEach(resultItem => {
				// Send telemetry for recommended VM SKU
				sendSqlMigrationActionEvent(
					TelemetryViews.SkuRecommendationWizard,
					TelemetryAction.GetVMSkuRecommendation,
					{
						'sessionId': this._sessionId,
						'recommendedSku': JSON.stringify(resultItem?.targetSku)
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
					'cpuRequirementInCores': this._skuRecommendationResults?.recommendations?.instanceRequirements?.cpuRequirementInCores,
					'dataStorageRequirementInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.dataStorageRequirementInMB,
					'logStorageRequirementInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.logStorageRequirementInMB,
					'memoryRequirementInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.memoryRequirementInMB,
					'dataIOPSRequirement': this._skuRecommendationResults?.recommendations?.instanceRequirements?.dataIOPSRequirement,
					'logIOPSRequirement': this._skuRecommendationResults?.recommendations?.instanceRequirements?.logIOPSRequirement,
					'ioLatencyRequirementInMs': this._skuRecommendationResults?.recommendations?.instanceRequirements?.ioLatencyRequirementInMs,
					'ioThroughputRequirementInMBps': this._skuRecommendationResults?.recommendations?.instanceRequirements?.ioThroughputRequirementInMBps,
					'tempDBSizeInMB': this._skuRecommendationResults?.recommendations?.instanceRequirements?.tempDBSizeInMB,
					'aggregationTargetPercentile': this._skuRecommendationResults?.recommendations?.instanceRequirements?.aggregationTargetPercentile,
					'numberOfDataPointsAnalyzed': this._skuRecommendationResults?.recommendations?.instanceRequirements?.numberOfDataPointsAnalyzed,
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
				const ownerUri = await azdata.connection.getUriForConnection(this.sourceConnectionId);
				const response = await this.migrationService.startPerfDataCollection(ownerUri, dataFolder, perfQueryIntervalInSec, staticQueryIntervalInSec, numberOfIterations);

				this._startPerfDataCollectionApiResponse = response!;
				this._perfDataCollectionStartDate = this._startPerfDataCollectionApiResponse.dateTimeStarted;
				this._perfDataCollectionStopDate = undefined;

				void vscode.window.showInformationMessage(constants.AZURE_RECOMMENDATION_START_POPUP);

				await this.startSkuTimers(page, this.refreshPerfDataCollectionFrequency);
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
				{}
			);

		} catch (e) {
			logError(TelemetryViews.DataCollectionWizard, 'StartDataCollectionTelemetryFailed', e);
		}
	}

	public async startSkuTimers(page: SKURecommendationPage, refreshIntervalInMs: number): Promise<void> {
		const classVariable = this;

		if (!this._autoRefreshPerfDataCollectionHandle) {
			clearInterval(this._autoRefreshPerfDataCollectionHandle);
			if (this.refreshPerfDataCollectionFrequency !== -1) {
				this._autoRefreshPerfDataCollectionHandle = setInterval(async function () {
					await classVariable.refreshPerfDataCollection();

					if (await classVariable.isWaitingForFirstTimeRefresh()) {
						await page.refreshSkuRecommendationComponents();	// update timer
					}
				}, refreshIntervalInMs);
			}
		}

		if (!this._autoRefreshGetSkuRecommendationHandle) {
			// start one-time timer to get SKU recommendation
			clearTimeout(this._autoRefreshGetSkuRecommendationHandle);
			if (this.refreshGetSkuRecommendationFrequency !== -1) {
				this._autoRefreshGetSkuRecommendationHandle = setTimeout(async function () {
					await page.refreshAzureRecommendation();
				}, this.refreshGetSkuRecommendationFrequency);
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
		this.generateStopDataCollectionTelemetry().catch(e => console.error(e));
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
				{}
			);

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
				void vscode.window.showInformationMessage(constants.PERF_DATA_COLLECTION_ERROR(this._assessmentApiResponse?.assessmentResult?.name, this._perfDataCollectionErrors));
			}
		}
		catch (error) {
			logError(TelemetryViews.DataCollectionWizard, 'RefreshDataCollectionFailed', error);
		}

		return true;
	}

	public async isWaitingForFirstTimeRefresh(): Promise<boolean> {
		const elapsedTimeInMins = Math.abs(new Date().getTime() - new Date(this._perfDataCollectionStartDate!).getTime()) / constants.TIME_IN_MINUTES(1);
		const skuRecAutoRefreshTimeInMins = this.refreshGetSkuRecommendationFrequency / constants.TIME_IN_MINUTES(1);

		return elapsedTimeInMins < skuRecAutoRefreshTimeInMins;
	}

	public performanceCollectionNotStarted(): boolean {
		if (!this._perfDataCollectionStartDate
			&& !this._perfDataCollectionStopDate) {
			return true;
		}
		return false;
	}

	public performanceCollectionInProgress(): boolean {
		if (this._perfDataCollectionStartDate
			&& !this._perfDataCollectionStopDate) {
			return true;
		}
		return false;
	}

	public performanceCollectionStopped(): boolean {
		if (this._perfDataCollectionStartDate
			&& this._perfDataCollectionStopDate) {
			return true;
		}
		return false;
	}

	private async generateAssessmentTelemetry(): Promise<void> {
		try {

			let serverIssues = this._assessmentResults?.issues.map(i => {
				return {
					ruleId: i.ruleId,
					count: i.impactedObjects.length
				};
			});

			const serverAssessmentErrorsMap: Map<number, number> = new Map();
			this._assessmentApiResponse?.assessmentResult?.errors?.forEach(e => {
				serverAssessmentErrorsMap.set(e.errorId, serverAssessmentErrorsMap.get(e.errorId) ?? 0 + 1);
			});

			let serverErrors: { errorId: number, count: number }[] = [];
			serverAssessmentErrorsMap.forEach((v, k) => {
				serverErrors.push(
					{
						errorId: k,
						count: v
					}
				);
			});

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
					}
				);

				d.items.forEach(i => {
					databaseWarningsMap.set(i.ruleId, databaseWarningsMap.get(i.ruleId) ?? 0 + i.impactedObjects.length);
				});

				d.errors.forEach(e => {
					databaseErrorsMap.set(e.errorId, databaseErrorsMap.get(e.errorId) ?? 0 + 1);
				});

			});

			let databaseWarnings: { warningId: string, count: number }[] = [];

			databaseWarningsMap.forEach((v, k) => {
				databaseWarnings.push({
					warningId: k,
					count: v
				});
			});

			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationWizardTargetSelectionPage,
				TelemetryAction.DatabaseAssessmentWarning,
				{
					'sessionId': this._sessionId,
					'warnings': JSON.stringify(databaseWarnings)
				},
				{}
			);

			let databaseErrors: { errorId: number, count: number }[] = [];
			databaseErrorsMap.forEach((v, k) => {
				databaseErrors.push({
					errorId: k,
					count: v
				});
			});

			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationWizardTargetSelectionPage,
				TelemetryAction.DatabaseAssessmentError,
				{
					'sessionId': this._sessionId,
					'errors': JSON.stringify(databaseErrors)
				},
				{}
			);

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

	public async getSourceConnectionProfile(): Promise<azdata.connection.ConnectionProfile> {
		const sqlConnections = await azdata.connection.getConnections();
		return sqlConnections.find((value) => {
			if (value.connectionId === this.sourceConnectionId) {
				return true;
			} else {
				return false;
			}
		})!;
	}

	public getLocationDisplayName(location: string): Promise<string> {
		return getLocationDisplayName(location);
	}

	public async getManagedDatabases(): Promise<string[]> {
		return (await getSqlManagedInstanceDatabases(this._azureAccount,
			this._targetSubscription,
			<SqlManagedInstance>this._targetServerInstance)).map(t => t.name);
	}

	public async startMigration() {
		const sqlConnections = await azdata.connection.getConnections();
		const currentConnection = sqlConnections.find((value) => {
			if (value.connectionId === this.sourceConnectionId) {
				return true;
			} else {
				return false;
			}
		});

		const isOfflineMigration = this._databaseBackup.migrationMode === MigrationMode.OFFLINE;

		const requestBody: StartDatabaseMigrationRequest = {
			location: this._sqlMigrationService?.location!,
			properties: {
				sourceDatabaseName: '',
				migrationService: this._sqlMigrationService?.id!,
				backupConfiguration: {},
				sourceSqlConnection: {
					dataSource: currentConnection?.serverName!,
					authentication: this._authenticationType,
					username: this._sqlServerUsername,
					password: this._sqlServerPassword
				},
				scope: this._targetServerInstance.id,
				offlineConfiguration: {
					offline: isOfflineMigration
				}
			}
		};

		for (let i = 0; i < this._databasesForMigration.length; i++) {
			try {
				switch (this._databaseBackup.networkContainerType) {
					case NetworkContainerType.BLOB_CONTAINER:
						requestBody.properties.backupConfiguration = {
							targetLocation: undefined!,
							sourceLocation: {
								fileStorageType: 'AzureBlob',
								azureBlob: {
									storageAccountResourceId: this._databaseBackup.blobs[i].storageAccount.id,
									accountKey: this._databaseBackup.blobs[i].storageKey,
									blobContainerName: this._databaseBackup.blobs[i].blobContainer.name
								}
							}
						};

						if (isOfflineMigration) {
							requestBody.properties.offlineConfiguration = {
								offline: isOfflineMigration,
								lastBackupName: this._databaseBackup.blobs[i]?.lastBackupFile
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
								fileStorageType: 'FileShare',
								fileShare: {
									path: this._databaseBackup.networkShares[i].networkShareLocation,
									username: this._databaseBackup.networkShares[i].windowsUser,
									password: this._databaseBackup.networkShares[i].password,
								}
							}
						};
						break;
				}
				requestBody.properties.sourceDatabaseName = this._databasesForMigration[i];
				const response = await startDatabaseMigration(
					this._azureAccount,
					this._targetSubscription,
					this._sqlMigrationService?.location!,
					this._targetServerInstance,
					this._targetDatabaseNames[i],
					requestBody,
					this._sessionId);

				response.databaseMigration.properties.sourceDatabaseName = this._databasesForMigration[i];
				response.databaseMigration.properties.backupConfiguration = requestBody.properties.backupConfiguration!;
				response.databaseMigration.properties.offlineConfiguration = requestBody.properties.offlineConfiguration!;

				let wizardEntryPoint = WizardEntryPoint.Default;
				if (this.resumeAssessment) {
					wizardEntryPoint = WizardEntryPoint.SaveAndClose;
				} else if (this.retryMigration) {
					wizardEntryPoint = WizardEntryPoint.RetryMigration;
				}
				if (response.status === 201 || response.status === 200) {
					sendSqlMigrationActionEvent(
						TelemetryViews.MigrationWizardSummaryPage,
						TelemetryAction.StartMigration,
						{
							'sessionId': this._sessionId,
							'tenantId': this._azureAccount.properties.tenants[0].id,
							'subscriptionId': this._targetSubscription?.id,
							'resourceGroup': this._resourceGroup?.name,
							'location': this._targetServerInstance.location,
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
						}
					);

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
					localize('sql.migration.starting.migration.error', "An error occurred while starting the migration: '{0}'", e.message));
				logError(TelemetryViews.MigrationLocalStorage, 'StartMigrationFailed', e);
			}
			finally {
				// kill existing data collection if user start migration
				await this.refreshPerfDataCollection();
				if ((!this.resumeAssessment || this.retryMigration) && this._perfDataCollectionIsCollecting) {
					void this.stopPerfDataCollection();
					void vscode.window.showInformationMessage(constants.AZURE_RECOMMENDATION_STOP_POPUP);
				}
			}
		}
	}

	public async saveInfo(serverName: string, currentPage: Page): Promise<void> {
		let saveInfo: SavedInfo;
		saveInfo = {
			closedPage: currentPage,
			databaseAssessment: [],
			databaseList: [],
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
			skuRecommendation: null,
		};
		switch (currentPage) {
			case Page.Summary:

			case Page.IntegrationRuntime:
				saveInfo.sqlMigrationService = this._sqlMigrationService;

			case Page.DatabaseBackup:
				saveInfo.networkContainerType = this._databaseBackup.networkContainerType;
				saveInfo.networkShares = this._databaseBackup.networkShares;
				saveInfo.blobs = this._databaseBackup.blobs;
				saveInfo.targetDatabaseNames = this._targetDatabaseNames;

			case Page.MigrationMode:
				saveInfo.migrationMode = this._databaseBackup.migrationMode;

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

				if (this._skuRecommendationPerformanceDataSource) {
					let skuRecommendation: SkuRecommendationSavedInfo = {
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
				await this.extensionContext.globalState.update(`${this.mementoString}.${serverName}`, saveInfo);
		}
	}

	public async loadSavedInfo(): Promise<Boolean> {
		try {
			this._targetType = this.savedInfo.migrationTargetType || undefined!;

			this._databasesForAssessment = this.savedInfo.databaseAssessment;
			this._databasesForMigration = this.savedInfo.databaseList;
			this._didUpdateDatabasesForMigration = true;
			switch (this._targetType) {
				case MigrationTargetType.SQLMI:
					this._miDbs = this._databasesForMigration;
					break;
				case MigrationTargetType.SQLVM:
					this._vmDbs = this._databasesForMigration;
					break;
			}

			this._azureAccount = this.savedInfo.azureAccount || undefined!;
			this._azureTenant = this.savedInfo.azureTenant || undefined!;

			this._targetSubscription = this.savedInfo.subscription || undefined!;
			this._location = this.savedInfo.location || undefined!;
			this._resourceGroup = this.savedInfo.resourceGroup || undefined!;
			this._targetServerInstance = this.savedInfo.targetServerInstance || undefined!;

			this._databaseBackup.migrationMode = this.savedInfo.migrationMode || undefined!;

			this.refreshDatabaseBackupPage = true;
			this._sourceDatabaseNames = this._databasesForMigration;
			this._targetDatabaseNames = this.savedInfo.targetDatabaseNames;
			this._databaseBackup.networkContainerType = this.savedInfo.networkContainerType || undefined!;
			this._databaseBackup.networkShares = this.savedInfo.networkShares;
			this._databaseBackup.blobs = this.savedInfo.blobs;
			this._databaseBackup.subscription = this.savedInfo.subscription || undefined!;

			this._sqlMigrationService = this.savedInfo.sqlMigrationService;

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
}

export interface ServerAssessment {
	issues: mssql.SqlMigrationAssessmentResultItem[];
	databaseAssessments: {
		name: string;
		issues: mssql.SqlMigrationAssessmentResultItem[];
		errors?: mssql.ErrorModel[];
	}[];
	errors?: mssql.ErrorModel[];
	assessmentError?: Error;
}

export interface SkuRecommendation {
	recommendations: mssql.SkuRecommendationResult;
	recommendationError?: Error;
}
