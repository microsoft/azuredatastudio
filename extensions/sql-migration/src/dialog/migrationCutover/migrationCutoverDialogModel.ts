/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getMigrationStatus, DatabaseMigration, startMigrationCutover, stopMigration, getMigrationAsyncOperationDetails, AzureAsyncOperationResource, BackupFileInfo } from '../../api/azure';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../../telemtery';
import * as constants from '../../constants/strings';

export class MigrationCutoverDialogModel {

	public migrationStatus!: DatabaseMigration;
	public migrationOpStatus!: AzureAsyncOperationResource;

	constructor(public _migration: MigrationContext) {
	}

	public async fetchStatus(): Promise<void> {
		if (this._migration.asyncUrl) {
			this.migrationOpStatus = (await getMigrationAsyncOperationDetails(
				this._migration.azureAccount,
				this._migration.subscription,
				this._migration.asyncUrl,
				this._migration.sessionId!
			));
		}
		this.migrationStatus = (await getMigrationStatus(
			this._migration.azureAccount,
			this._migration.subscription,
			this._migration.migrationContext,
			this._migration.sessionId!,
		));

		sendSqlMigrationActionEvent(
			TelemetryViews.MigrationCutoverDialog,
			TelemetryAction.MigrationStatus,
			{
				'sessionId': this._migration.sessionId!,
				'migrationStatus': this.migrationStatus.properties.migrationStatus
			},
			{}
		);
		// Logging status to help debugging.
		console.log(this.migrationStatus);
	}

	public async startCutover(): Promise<DatabaseMigration | undefined> {
		try {
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
						'sessionId': this._migration.sessionId!,
						'migrationEndTime': new Date().toString()
					},
					{}
				);
				return cutover;
			}
		} catch (error) {
			console.log(error);
		}
		return undefined!;
	}

	public async cancelMigration(): Promise<void> {
		try {
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
						'sessionId': this._migration.sessionId!,
						'cutoverStartTime': cutoverStartTime
					},
					{}
				);
			}
		} catch (error) {
			console.log(error);
		}
		return undefined!;
	}

	public isBlobMigration(): boolean {
		return this._migration.migrationContext.properties.backupConfiguration.sourceLocation?.azureBlob !== undefined;
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
				if (f.status !== 'Restored') {
					files.push(f);
				}
			});
		});
		return files;
	}
}
