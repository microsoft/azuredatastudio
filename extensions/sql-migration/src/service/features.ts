/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import {
	ClientCapabilities,
	RPCMessageType,
	ServerCapabilities,
} from 'vscode-languageclient';

import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Disposable } from 'vscode';

import * as contracts from './contracts';
import { migrationServiceProvider } from './provider';

export enum ApiType {
	SqlMigrationProvider = 'SqlMigrationProvider',
}


export abstract class MigrationExtensionService extends SqlOpsFeature<undefined> {
	abstract providerId: ApiType;
}

export class SqlMigrationService extends MigrationExtensionService implements contracts.ISqlMigrationService {
	private _reportUpdate: ((dbName: string, succeeded: boolean, error: string, statusCode: string) => void) | undefined = undefined;

	override providerId = ApiType.SqlMigrationProvider;

	private static readonly messagesTypes: RPCMessageType[] = [
		contracts.GetSqlMigrationAssessmentItemsRequest.type,
		contracts.GetSqlMigrationSkuRecommendationsRequest.type,
		contracts.SqlMigrationStartPerfDataCollectionRequest.type,
		contracts.SqlMigrationRefreshPerfDataCollectionRequest.type,
		contracts.SqlMigrationStopPerfDataCollectionRequest.type,
		contracts.StartLoginMigrationRequest.type,
		contracts.ValidateLoginMigrationRequest.type,
		contracts.ValidateSysAdminPermissionRequest.type,
		contracts.ValidateUserMappingRequest.type,
		contracts.ValidateAADDomainNameRequest.type,
		contracts.ValidateLoginEligibilityRequest.type,
		contracts.MigrateLoginsRequest.type,
		contracts.EstablishUserMappingRequest.type,
		contracts.MigrateServerRolesAndSetPermissionsRequest.type,
		contracts.TdeMigrateRequest.type,
		contracts.GetSqlMigrationGenerateArmTemplateRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, SqlMigrationService.messagesTypes);
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});

		this._client.onNotification(contracts.TdeMigrateProgressEvent.type, e => {
			if (this._reportUpdate === undefined) {
				return;
			}
			this._reportUpdate(e.name, e.success, e.message, e.statusCode ?? '');
		});
	}

	protected registerProvider(options: undefined): Disposable {
		migrationServiceProvider.addService(this);
		return this;
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		// this isn't explicitly necessary
	}

	async getAssessments(connectionString: string, databases: string[], xEventsFilesFolderPath: string, collectAdhocQueries: boolean): Promise<contracts.AssessmentResult | undefined> {
		let params: contracts.SqlMigrationAssessmentParams = { connectionString: connectionString, databases: databases, xEventsFilesFolderPath: xEventsFilesFolderPath, collectAdhocQueries: collectAdhocQueries };
		try {
			return this._client.sendRequest(contracts.GetSqlMigrationAssessmentItemsRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.GetSqlMigrationAssessmentItemsRequest.type, e);
		}

		return undefined;
	}

	async getArmTemplate(skuRecommendationReportFilePath: string): Promise<string[] | undefined> {
		try {
			const response = this._client.sendRequest(contracts.GetSqlMigrationGenerateArmTemplateRequest.type, skuRecommendationReportFilePath);
			return response;
		}
		catch (e) {
			this._client.logFailedRequest(contracts.GetSqlMigrationGenerateArmTemplateRequest.type, e);
		}

		return undefined;
	}

	async getSkuRecommendations(
		dataFolder: string,
		perfQueryIntervalInSec: number,
		targetPlatforms: string[],
		targetSqlInstance: string,
		targetPercentile: number,
		scalingFactor: number,
		startTime: string,
		endTime: string,
		includePreviewSkus: boolean,
		databaseAllowList: string[]): Promise<contracts.SkuRecommendationResult | undefined> {
		let params: contracts.SqlMigrationSkuRecommendationsParams = {
			dataFolder: dataFolder,
			perfQueryIntervalInSec: perfQueryIntervalInSec,
			targetPlatforms: targetPlatforms,
			targetSqlInstance: targetSqlInstance,
			targetPercentile: targetPercentile,
			scalingFactor: scalingFactor,
			startTime: startTime,
			endTime: endTime,
			includePreviewSkus: includePreviewSkus,
			databaseAllowList: databaseAllowList,
			isPremiumSSDV2Enabled: true,
			isNextGenGPEnabled: includePreviewSkus
		};

		try {
			return this._client.sendRequest(contracts.GetSqlMigrationSkuRecommendationsRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.GetSqlMigrationSkuRecommendationsRequest.type, e);
		}

		return undefined;
	}

	async startPerfDataCollection(
		connectionString: string,
		dataFolder: string,
		perfQueryIntervalInSec: number,
		staticQueryIntervalInSec: number,
		numberOfIterations: number): Promise<contracts.StartPerfDataCollectionResult | undefined> {
		let params: contracts.SqlMigrationStartPerfDataCollectionParams = {
			connectionString: connectionString,
			dataFolder,
			perfQueryIntervalInSec,
			staticQueryIntervalInSec,
			numberOfIterations
		};

		try {
			return this._client.sendRequest(contracts.SqlMigrationStartPerfDataCollectionRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.SqlMigrationStartPerfDataCollectionRequest.type, e);
		}

		return undefined;
	}

	async stopPerfDataCollection(): Promise<contracts.StopPerfDataCollectionResult | undefined> {
		let params: contracts.SqlMigrationStopPerfDataCollectionParams = {};

		try {
			return this._client.sendRequest(contracts.SqlMigrationStopPerfDataCollectionRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.SqlMigrationStopPerfDataCollectionRequest.type, e);
		}

		return undefined;
	}

	async refreshPerfDataCollection(lastRefreshedTime: Date): Promise<contracts.RefreshPerfDataCollectionResult | undefined> {
		let params: contracts.SqlMigrationStopPerfDataCollectionParams = {
			lastRefreshedTime
		};

		try {
			return this._client.sendRequest(contracts.SqlMigrationRefreshPerfDataCollectionRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.SqlMigrationRefreshPerfDataCollectionRequest.type, e);
		}

		return undefined;
	}

	async startLoginMigration(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.StartLoginMigrationRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.StartLoginMigrationRequest.type, e);
		}

		return undefined;
	}

	async validateLoginMigration(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.ValidateLoginMigrationRequest.type, params);

		}
		catch (e) {
			this._client.logFailedRequest(contracts.ValidateLoginMigrationRequest.type, e);
		}

		return undefined;
	}

	async validateSysAdminPermission(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationPreValidationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.ValidateSysAdminPermissionRequest.type, params);

		}
		catch (e) {
			this._client.logFailedRequest(contracts.ValidateSysAdminPermissionRequest.type, e);
		}

		return undefined;
	}

	async validateUserMapping(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationPreValidationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.ValidateUserMappingRequest.type, params);

		}
		catch (e) {
			this._client.logFailedRequest(contracts.ValidateUserMappingRequest.type, e);
		}

		return undefined;
	}

	async validateAADDomainName(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationPreValidationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.ValidateAADDomainNameRequest.type, params);

		}
		catch (e) {
			this._client.logFailedRequest(contracts.ValidateAADDomainNameRequest.type, e);
		}

		return undefined;
	}

	async validateLoginEligibility(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationPreValidationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.ValidateLoginEligibilityRequest.type, params);

		}
		catch (e) {
			this._client.logFailedRequest(contracts.ValidateLoginEligibilityRequest.type, e);
		}

		return undefined;
	}

	async migrateLogins(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.MigrateLoginsRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.MigrateLoginsRequest.type, e);
		}

		return undefined;
	}

	async establishUserMapping(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.EstablishUserMappingRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.EstablishUserMappingRequest.type, e);
		}

		return undefined;
	}

	async migrateServerRolesAndSetPermissions(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<contracts.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this._client.sendRequest(contracts.MigrateServerRolesAndSetPermissionsRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.MigrateServerRolesAndSetPermissionsRequest.type, e);
		}

		return undefined;
	}

	async migrateCertificate(
		tdeEnabledDatabases: string[],
		sourceSqlConnectionString: string,
		targetSubscriptionId: string,
		targetResourceGroupName: string,
		targetManagedInstanceName: string,
		networkSharePath: string,
		accessToken: string,
		reportUpdate: (dbName: string, succeeded: boolean, message: string, statusCode: string) => void): Promise<contracts.TdeMigrationResult | undefined> {

		this._reportUpdate = reportUpdate;
		let params: contracts.TdeMigrationParams = {
			encryptedDatabases: tdeEnabledDatabases,
			sourceSqlConnectionString: sourceSqlConnectionString,
			targetSubscriptionId: targetSubscriptionId,
			targetResourceGroupName: targetResourceGroupName,
			targetManagedInstanceName: targetManagedInstanceName,
			networkSharePath: networkSharePath,
			networkShareDomain: 'a', // Will remove this on the next STS version
			networkShareUserName: 'b',
			networkSharePassword: 'c',
			accessToken: accessToken
		};

		try {
			// This call needs to be awaited so, the updates are sent during the execution of the task.
			// If the task is not awaited, the finally block will execute and no updates will be sent.
			const result = await this._client.sendRequest(contracts.TdeMigrateRequest.type, params);
			return result;
		}
		catch (e) {
			this._client.logFailedRequest(contracts.TdeMigrateRequest.type, e);
		}

		return undefined;
	}

	async runTdeValidation(
		sourceSqlConnectionString: string,
		networkSharePath: string,
	) {
		let params: contracts.TdeValidationParams = {
			sourceSqlConnectionString: sourceSqlConnectionString,
			networkSharePath: networkSharePath,
		};

		try {
			return await this._client.sendRequest(contracts.TdeValidationRequest.type, params);
		}
		catch (e) {
			this._client.logFailedRequest(contracts.TdeValidationRequest.type, e);
		}

		return undefined;
	}

	async getTdeValidationTitles() {
		try {
			return await this._client.sendRequest(contracts.TdeValidationTitlesRequest.type, {});
		}
		catch (e) {
			this._client.logFailedRequest(contracts.TdeValidationRequest.type, e);
		}

		return undefined;
	}
}
