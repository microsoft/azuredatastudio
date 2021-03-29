/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getMigrationStatus, DatabaseMigration, startMigrationCutover, stopMigration } from '../../api/azure';
import { MigrationContext } from '../../models/migrationLocalStorage';


export class MigrationCutoverDialogModel {

	public migrationStatus!: DatabaseMigration;

	constructor(public _migration: MigrationContext) {
	}

	public async fetchStatus(): Promise<void> {
		this.migrationStatus = (await getMigrationStatus(
			this._migration.azureAccount,
			this._migration.subscription,
			this._migration.migrationContext
		));
		// Logging status to help debugging.
		console.log(this.migrationStatus);
	}

	public async startCutover(): Promise<DatabaseMigration | undefined> {
		try {
			if (this.migrationStatus) {
				return await startMigrationCutover(
					this._migration.azureAccount,
					this._migration.subscription,
					this.migrationStatus
				);
			}
		} catch (error) {
			console.log(error);
		}
		return undefined!;
	}

	public async cancelMigration(): Promise<void> {
		try {
			if (this.migrationStatus) {
				await stopMigration(
					this._migration.azureAccount,
					this._migration.subscription,
					this.migrationStatus
				);
			}
		} catch (error) {
			console.log(error);
		}
		return undefined!;
	}
}
