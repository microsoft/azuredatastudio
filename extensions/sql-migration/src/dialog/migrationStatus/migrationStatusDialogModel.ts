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
			name: 'All',
		}, {
			displayName: 'Status: Ongoing',
			name: 'Ongoing',
		}, {
			displayName: 'Status: Succeeded',
			name: 'Succeeded',
		}
	];

	constructor(public _migrations: MigrationContext[]) {
	}

	public filterMigration(databaseName: string, category: string): MigrationContext[] {
		let filteredMigration: MigrationContext[] = [];
		if (category === 'All') {
			filteredMigration = this._migrations;
		} else if (category === 'Ongoing') {
			filteredMigration = this._migrations.filter((value) => {
				const status = value.migrationContext.properties.migrationStatus;
				return status === 'InProgress' || status === 'Creating' || status === 'Completing';
			});
		} else if (category === 'Succeeded') {
			filteredMigration = this._migrations.filter((value) => {
				const status = value.migrationContext.properties.migrationStatus;
				return status === 'Succeeded';
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

export enum MigrationCategory {
	ALL,
	ONGOING,
	SUCCEEDED
}
