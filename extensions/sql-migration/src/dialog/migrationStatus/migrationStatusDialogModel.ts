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
			displayName: 'Status: Completing',
			name: AdsMigrationStatus.COMPLETING
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

}

/**
 * This enum is used to categorize migrations internally in ADS. A migration has 2 statuses: Provisioning Status and Migration Status. The values from both the statuses are mapped to different values in this enum
 */
export enum AdsMigrationStatus {
	ALL = 'all',
	ONGOING = 'ongoing',
	SUCCEEDED = 'succeeded',
	FAILED = 'failed',
	COMPLETING = 'completing'
}
