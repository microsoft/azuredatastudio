/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChartsConfiguration } from 'sql/workbench/contrib/charts/browser/interfaces';
import * as nls from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

/**
 * Gets the max allowed row count for chart rendering.
 */
export function getChartMaxRowCount(configurationService: IConfigurationService): number {
	return configurationService.getValue<IChartsConfiguration>('builtinCharts').maxRowCount;
}

/**
 * Show a toast notification about the max row count for chart has exceeded.
 */
export function notifyMaxRowCountExceeded(storageService: IStorageService, notificationService: INotificationService, configurationService: IConfigurationService): void {
	const storageKey = 'charts/ignoreMaxRowCountExceededNotification';
	if (!storageService.getBoolean(storageKey, StorageScope.APPLICATION, false)) {
		notificationService.prompt(Severity.Info,
			nls.localize('charts.maxAllowedRowsExceeded', "Maximum row count for built-in charts has been exceeded, only the first {0} rows are used. To configure the value, you can open user settings and search for: 'builtinCharts.maxRowCount'.", getChartMaxRowCount(configurationService)),
			[{
				label: nls.localize('charts.neverShowAgain', "Don't Show Again"),
				isSecondary: true,
				run: () => {
					storageService.store(storageKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
				}
			}]);
	}
}
