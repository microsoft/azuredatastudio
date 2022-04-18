/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DatabaseMigration, startMigrationCutover, stopMigration, BackupFileInfo, getResourceGroupFromId, getMigrationDetails, getMigrationTargetName } from '../../api/azure';
import { BackupFileInfoStatus, MigrationServiceContext } from '../../models/migrationLocalStorage';
import { logError, sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../../telemtery';
import * as constants from '../../constants/strings';
import { EOL } from 'os';
import { getMigrationTargetType, getMigrationMode, isBlobMigration } from '../../constants/helper';

export class MigrationCutoverDialogModel {
	public CutoverError?: Error;
	public CancelMigrationError?: Error;
	public migrationStatus!: DatabaseMigration;


	constructor(
		public _serviceConstext: MigrationServiceContext,
		public _migration: DatabaseMigration
	) {
	}

	public async fetchStatus(): Promise<void> {
		this.migrationStatus = await getMigrationDetails(
			this._serviceConstext.azureAccount!,
			this._serviceConstext.subscription!,
			this._migration.id,
			this._migration.properties?.migrationOperationId);

		sendSqlMigrationActionEvent(
			TelemetryViews.MigrationCutoverDialog,
			TelemetryAction.MigrationStatus,
			{
				'migrationStatus': this.migrationStatus.properties?.migrationStatus
			},
			{}
		);
		// Logging status to help debugging.
		console.log(this.migrationStatus);
	}

	public async startCutover(): Promise<DatabaseMigration | undefined> {
		try {
			this.CutoverError = undefined;
			if (this._migration) {
				const cutover = await startMigrationCutover(
					this._serviceConstext.azureAccount!,
					this._serviceConstext.subscription!,
					this._migration!);
				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationCutoverDialog,
					TelemetryAction.CutoverMigration,
					{
						...this.getTelemetryProps(this._serviceConstext, this._migration),
						'migrationEndTime': new Date().toString(),
					},
					{}
				);
				return cutover;
			}
		} catch (error) {
			this.CutoverError = error;
			logError(TelemetryViews.MigrationCutoverDialog, 'StartCutoverError', error);
		}
		return undefined!;
	}

	public async fetchErrors(): Promise<string> {
		const errors = [];
		await this.fetchStatus();
		errors.push(this.migrationStatus.properties.migrationFailureError?.message);
		return errors
			.filter((e, i, arr) => e !== undefined && i === arr.indexOf(e))
			.join(EOL);
	}

	public async cancelMigration(): Promise<void> {
		try {
			this.CancelMigrationError = undefined;
			if (this.migrationStatus) {
				const cutoverStartTime = new Date().toString();
				await stopMigration(
					this._serviceConstext.azureAccount!,
					this._serviceConstext.subscription!,
					this.migrationStatus);
				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationCutoverDialog,
					TelemetryAction.CancelMigration,
					{
						...this.getTelemetryProps(this._serviceConstext, this._migration),
						'migrationMode': getMigrationMode(this._migration),
						'cutoverStartTime': cutoverStartTime,
					},
					{}
				);
			}
		} catch (error) {
			this.CancelMigrationError = error;
			logError(TelemetryViews.MigrationCutoverDialog, 'CancelMigrationError', error);
		}
		return undefined!;
	}

	public confirmCutoverStepsString(): string {
		if (isBlobMigration(this.migrationStatus)) {
			return `${constants.CUTOVER_HELP_STEP1}
			${constants.CUTOVER_HELP_STEP2_BLOB_CONTAINER}
			${constants.CUTOVER_HELP_STEP3_BLOB_CONTAINER}`;
		} else {
			return `${constants.CUTOVER_HELP_STEP1}
			${constants.CUTOVER_HELP_STEP2_NETWORK_SHARE}
			${constants.CUTOVER_HELP_STEP3_NETWORK_SHARE}`;
		}
	}

	public getLastBackupFileRestoredName(): string | undefined {
		return this.migrationStatus.properties.migrationStatusDetails?.lastRestoredFilename;
	}

	public getPendingLogBackupsCount(): number | undefined {
		return this.migrationStatus.properties.migrationStatusDetails?.pendingLogBackupsCount;
	}

	public getPendingFiles(): BackupFileInfo[] {
		const files: BackupFileInfo[] = [];
		this.migrationStatus.properties.migrationStatusDetails?.activeBackupSets?.forEach(abs => {
			abs.listOfBackupFiles.forEach(f => {
				if (f.status !== BackupFileInfoStatus.Restored) {
					files.push(f);
				}
			});
		});
		return files;
	}

	private getTelemetryProps(serviceContext: MigrationServiceContext, migration: DatabaseMigration) {
		return {
			'subscriptionId': serviceContext.subscription!.id,
			'resourceGroup': getResourceGroupFromId(migration.id),
			'sqlServerName': migration.properties.sourceServerName,
			'sourceDatabaseName': migration.properties.sourceDatabaseName,
			'targetType': getMigrationTargetType(migration),
			'targetDatabaseName': migration.name,
			'targetServerName': getMigrationTargetName(migration),
		};
	}
}
