/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getMigrationStatus, DatabaseMigration, startMigrationCutover, stopMigration, getMigrationAsyncOperationDetails, AzureAsyncOperationResource, BackupFileInfo, getResourceGroupFromId } from '../../api/azure';
import { BackupFileInfoStatus, MigrationContext } from '../../models/migrationLocalStorage';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../../telemtery';
import * as constants from '../../constants/strings';
import { EOL } from 'os';
import { getMigrationTargetType, getMigrationMode } from '../../constants/helper';

export class MigrationCutoverDialogModel {
	public CutoverError?: Error;
	public CancelMigrationError?: Error;

	public migrationStatus!: DatabaseMigration;
	public migrationOpStatus!: AzureAsyncOperationResource;

	constructor(public _migration: MigrationContext) {
	}

	public async fetchStatus(): Promise<void> {
		if (this._migration.asyncUrl) {
			this.migrationOpStatus = await getMigrationAsyncOperationDetails(
				this._migration.azureAccount,
				this._migration.subscription,
				this._migration.asyncUrl,
				this._migration.sessionId!);
		}

		this.migrationStatus = await getMigrationStatus(
			this._migration.azureAccount,
			this._migration.subscription,
			this._migration.migrationContext,
			this._migration.sessionId!);

		sendSqlMigrationActionEvent(
			TelemetryViews.MigrationCutoverDialog,
			TelemetryAction.MigrationStatus,
			{
				'sessionId': this._migration.sessionId!,
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
			if (this.migrationStatus) {
				const cutover = await startMigrationCutover(
					this._migration.azureAccount,
					this._migration.subscription,
					this.migrationStatus,
					this._migration.sessionId!
				);
				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationCutoverDialog,
					TelemetryAction.CutoverMigration,
					{
						...this.getTelemetryProps(this._migration),
						'migrationEndTime': new Date().toString(),
					},
					{}
				);
				return cutover;
			}
		} catch (error) {
			this.CutoverError = error;
			console.log(error);
		}
		return undefined!;
	}

	public async fetchErrors(): Promise<string> {
		const errors = [];
		await this.fetchStatus();
		errors.push(this.migrationOpStatus.error?.message);
		errors.push(this._migration.asyncOperationResult?.error?.message);
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
					this._migration.azureAccount,
					this._migration.subscription,
					this.migrationStatus,
					this._migration.sessionId!
				);
				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationCutoverDialog,
					TelemetryAction.CancelMigration,
					{
						...this.getTelemetryProps(this._migration),
						'migrationMode': getMigrationMode(this._migration),
						'cutoverStartTime': cutoverStartTime
					},
					{}
				);
			}
		} catch (error) {
			this.CancelMigrationError = error;
			console.log(error);
		}
		return undefined!;
	}

	public isBlobMigration(): boolean {
		return this._migration.migrationContext.properties.backupConfiguration?.sourceLocation?.azureBlob !== undefined;
	}

	public confirmCutoverStepsString(): string {
		if (this.isBlobMigration()) {
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

	public getPendingfiles(): BackupFileInfo[] {
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

	private getTelemetryProps(migration: MigrationContext) {
		return {
			'sessionId': migration.sessionId!,
			'subscriptionId': migration.subscription.id,
			'resourceGroup': getResourceGroupFromId(migration.targetManagedInstance.id),
			'sqlServerName': migration.sourceConnectionProfile.serverName,
			'sourceDatabaseName': migration.migrationContext.properties.sourceDatabaseName,
			'targetType': getMigrationTargetType(migration),
			'targetDatabaseName': migration.migrationContext.name,
			'targetServerName': migration.targetManagedInstance.name,
		};
	}
}
