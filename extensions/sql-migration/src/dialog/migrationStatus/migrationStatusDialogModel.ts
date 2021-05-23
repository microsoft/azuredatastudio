/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationContext } from '../../models/migrationLocalStorage';

export class MigrationStatusDialogModel {
	public statusDropdownValues: azdata.CategoryValue[] = [
		{
			displayName: 'Status: All',
			name: AdsMigrationStatus.ALL,
		}, {
			displayName: 'Status: Ongoing',
			name: AdsMigrationStatus.ONGOING,
		}, {
			displayName: 'Status: Succeeded',
			name: AdsMigrationStatus.SUCCEEDED,
		}, {
			displayName: 'Status: Failed',
			name: AdsMigrationStatus.FAILED
		}
	];

	constructor(public _migrations: MigrationContext[]) {
	}

	public filterMigration(databaseName: string, category: string): MigrationContext[] {
		let filteredMigration: MigrationContext[] = [];
		if (category === AdsMigrationStatus.ALL) {
			filteredMigration = this._migrations;
		} else if (category === AdsMigrationStatus.ONGOING) {
			filteredMigration = this._migrations.filter((value) => {
				const status = value.migrationContext.properties.migrationStatus;
				const provisioning = value.migrationContext.properties.provisioningState;
				return status === 'InProgress' || status === 'Creating' || status === 'Completing' || provisioning === 'Creating';
			});
		} else if (category === AdsMigrationStatus.SUCCEEDED) {
			filteredMigration = this._migrations.filter((value) => {
				const status = value.migrationContext.properties.migrationStatus;
				return status === 'Succeeded';
			});
		} else if (category === AdsMigrationStatus.FAILED) {
			filteredMigration = this._migrations.filter((value) => {
				const status = value.migrationContext.properties.migrationStatus;
				const provisioning = value.migrationContext.properties.provisioningState;
				return status === 'Failed' || provisioning === 'Failed';
			});
		}
		if (databaseName) {
			filteredMigration = filteredMigration.filter((value) => {
				return value.migrationContext.name.toLowerCase().includes(databaseName.toLowerCase());
			});
		}

		return filteredMigration;
	}
}


/**
 * This enum is used to categorize migrations internally in ADS. A migration has 2 statuses: Provisioning Status and Migration Status. The values from both the statuses are mapped to different values in this enum
 */
export enum AdsMigrationStatus {
	ALL = 'all',
	ONGOING = 'ongoing',
	SUCCEEDED = 'succeeded',
	FAILED = 'failed'
}
