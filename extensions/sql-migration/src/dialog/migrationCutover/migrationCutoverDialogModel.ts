/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DatabaseMigration, startMigrationCutover, stopMigration, BackupFileInfo, getResourceGroupFromId, getMigrationDetails, getMigrationTargetName } from '../../api/azure';
import { MigrationServiceContext } from '../../models/migrationLocalStorage';
import { logError, sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../../telemetry';
import * as constants from '../../constants/strings';
import { getMigrationTargetType, getMigrationMode, isBlobMigration } from '../../constants/helper';

export class MigrationCutoverDialogModel {
	public CutoverError?: Error;
	public CancelMigrationError?: Error;

	constructor(
		public serviceContext: MigrationServiceContext,
		public migration: DatabaseMigration) { }

	public async fetchStatus(): Promise<void> {
		try {
			const migrationStatus = await getMigrationDetails(
				this.serviceContext.azureAccount!,
				this.serviceContext.subscription!,
				this.migration.id,
				this.migration.properties?.migrationOperationId);
			this.migration = migrationStatus;
		} catch (error) {
			logError(TelemetryViews.MigrationDetailsTab, 'fetchStatus', error);
		} finally {
			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationDetailsTab,
				TelemetryAction.MigrationStatus,
				{ 'migrationStatus': this.migration.properties?.migrationStatus },
				{});
		}
	}

	public async startCutover(): Promise<DatabaseMigration | undefined> {
		try {
			this.CutoverError = undefined;
			if (this.migration) {
				const cutover = await startMigrationCutover(
					this.serviceContext.azureAccount!,
					this.serviceContext.subscription!,
					this.migration!);
				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationCutoverDialog,
					TelemetryAction.CutoverMigration,
					{
						...this.getTelemetryProps(this.serviceContext, this.migration),
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

	public async cancelMigration(cancellationReason: string): Promise<void> {
		try {
			this.CancelMigrationError = undefined;
			if (this.migration) {
				const cutoverStartTime = new Date().toString();
				await stopMigration(
					this.serviceContext.azureAccount!,
					this.serviceContext.subscription!,
					this.migration);
				sendSqlMigrationActionEvent(
					TelemetryViews.MigrationCutoverDialog,
					TelemetryAction.CancelMigration,
					{
						...this.getTelemetryProps(this.serviceContext, this.migration),
						'migrationMode': getMigrationMode(this.migration),
						'cutoverStartTime': cutoverStartTime,
						'cancellationReason': cancellationReason
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
		if (isBlobMigration(this.migration)) {
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
		return this.migration.properties.migrationStatusDetails?.lastRestoredFilename;
	}

	public getPendingLogBackupsCount(): number | undefined {
		return this.migration.properties.migrationStatusDetails?.pendingLogBackupsCount;
	}

	public getPendingFiles(): BackupFileInfo[] {
		const files: BackupFileInfo[] = [];
		this.migration.properties.migrationStatusDetails?.activeBackupSets?.forEach(abs => {
			abs.listOfBackupFiles.forEach(f => {
				if (f.status !== constants.BackupFileInfoStatus.Restored) {
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
