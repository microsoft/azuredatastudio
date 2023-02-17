/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as contracts from '../contracts';

export class SqlMigrationService implements mssql.ISqlMigrationService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SqlMigrationService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.SqlMigrationService, this);
	}

	async getAssessments(ownerUri: string, databases: string[], xEventsFilesFolderPath: string): Promise<mssql.AssessmentResult | undefined> {
		let params: contracts.SqlMigrationAssessmentParams = { ownerUri: ownerUri, databases: databases, xEventsFilesFolderPath: xEventsFilesFolderPath };
		try {
			return this.client.sendRequest(contracts.GetSqlMigrationAssessmentItemsRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.GetSqlMigrationAssessmentItemsRequest.type, e);
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
		databaseAllowList: string[]): Promise<mssql.SkuRecommendationResult | undefined> {
		let params: contracts.SqlMigrationSkuRecommendationsParams = {
			dataFolder,
			perfQueryIntervalInSec,
			targetPlatforms,
			targetSqlInstance,
			targetPercentile,
			scalingFactor,
			startTime,
			endTime,
			includePreviewSkus,
			databaseAllowList
		};

		try {
			return this.client.sendRequest(contracts.GetSqlMigrationSkuRecommendationsRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.GetSqlMigrationSkuRecommendationsRequest.type, e);
		}

		return undefined;
	}

	// async generateProvisioningScript(skuRecommendations: mssql.SkuRecommendationResultItem[]): Promise<mssql.ProvisioningScriptResult | undefined> {
	// 	let params: contracts.SqlMigrationGenerateProvisioningScriptParams = { skuRecommendations: skuRecommendations };

	// 	try {
	// 		return this.client.sendRequest(contracts.SqlMigrationGenerateProvisioningScriptRequest.type, params);
	// 	}
	// 	catch (e) {
	// 		this.client.logFailedRequest(contracts.SqlMigrationGenerateProvisioningScriptRequest.type, e);
	// 	}

	// 	return undefined;
	// }

	async startPerfDataCollection(
		ownerUri: string,
		dataFolder: string,
		perfQueryIntervalInSec: number,
		staticQueryIntervalInSec: number,
		numberOfIterations: number): Promise<mssql.StartPerfDataCollectionResult | undefined> {
		let params: contracts.SqlMigrationStartPerfDataCollectionParams = {
			ownerUri,
			dataFolder,
			perfQueryIntervalInSec,
			staticQueryIntervalInSec,
			numberOfIterations
		};

		try {
			return this.client.sendRequest(contracts.SqlMigrationStartPerfDataCollectionRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.SqlMigrationStartPerfDataCollectionRequest.type, e);
		}

		return undefined;
	}

	async stopPerfDataCollection(): Promise<mssql.StopPerfDataCollectionResult | undefined> {
		let params: contracts.SqlMigrationStopPerfDataCollectionParams = {};

		try {
			return this.client.sendRequest(contracts.SqlMigrationStopPerfDataCollectionRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.SqlMigrationStopPerfDataCollectionRequest.type, e);
		}

		return undefined;
	}

	async refreshPerfDataCollection(lastRefreshedTime: Date): Promise<mssql.RefreshPerfDataCollectionResult | undefined> {
		let params: contracts.SqlMigrationStopPerfDataCollectionParams = {
			lastRefreshedTime
		};

		try {
			return this.client.sendRequest(contracts.SqlMigrationRefreshPerfDataCollectionRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.SqlMigrationRefreshPerfDataCollectionRequest.type, e);
		}

		return undefined;
	}

	async startLoginMigration(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<mssql.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this.client.sendRequest(contracts.StartLoginMigrationRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.StartLoginMigrationRequest.type, e);
		}

		return undefined;
	}

	async validateLoginMigration(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<mssql.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this.client.sendRequest(contracts.ValidateLoginMigrationRequest.type, params);

		}
		catch (e) {
			this.client.logFailedRequest(contracts.ValidateLoginMigrationRequest.type, e);
		}

		return undefined;
	}

	async migrateLogins(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<mssql.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this.client.sendRequest(contracts.MigrateLoginsRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.MigrateLoginsRequest.type, e);
		}

		return undefined;
	}

	async establishUserMapping(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<mssql.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this.client.sendRequest(contracts.EstablishUserMappingRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.EstablishUserMappingRequest.type, e);
		}

		return undefined;
	}

	async migrateServerRolesAndSetPermissions(
		sourceConnectionString: string,
		targetConnectionString: string,
		loginList: string[],
		aadDomainName: string): Promise<mssql.StartLoginMigrationResult | undefined> {
		let params: contracts.StartLoginMigrationsParams = {
			sourceConnectionString,
			targetConnectionString,
			loginList,
			aadDomainName
		};

		try {
			return this.client.sendRequest(contracts.MigrateServerRolesAndSetPermissionsRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.MigrateServerRolesAndSetPermissionsRequest.type, e);
		}

		return undefined;
	}
}
