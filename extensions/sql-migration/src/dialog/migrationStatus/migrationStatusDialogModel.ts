/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../constants/strings';
import { MigrationContext } from '../../models/migrationLocalStorage';

export class MigrationStatusDialogModel {
	public statusDropdownValues: azdata.CategoryValue[] = [
		{
			displayName: loc.STATUS_ALL,
			name: AdsMigrationStatus.ALL
		}, {
			displayName: loc.STATUS_ONGOING,
			name: AdsMigrationStatus.ONGOING
		}, {
			displayName: loc.STATUS_COMPLETING,
			name: AdsMigrationStatus.COMPLETING
		}, {
			displayName: loc.STATUS_SUCCEEDED,
			name: AdsMigrationStatus.SUCCEEDED
		}, {
			displayName: loc.STATUS_FAILED,
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
