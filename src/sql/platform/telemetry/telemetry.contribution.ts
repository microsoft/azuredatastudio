/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';

export class SqlTelemetryContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IStorageService storageService: IStorageService
	) {
		super();

		const dailyLastUseDate: number = Date.parse(storageService.get('telemetry.dailyLastUseDate', StorageScope.GLOBAL, '0'));
		const weeklyLastUseDate: number  = Date.parse(storageService.get('telemetry.weeklyLastUseDate', StorageScope.GLOBAL, '0'));
		const monthlyLastUseDate: number  = Date.parse(storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL, '0'));
		const firstTimeUser: boolean = dailyLastUseDate === Date.parse('0');

		let today: Date = new Date();
		let todayString: string = new Date().toUTCString();

		// daily user event
		if (this.diffInDays(Date.parse(todayString), dailyLastUseDate) >= 1) {
			// daily first use
			telemetryService.publicLog('telemetry.dailyFirstUse', { dailyFirstUse: true });
			storageService.store('telemetry.dailyLastUseDate', todayString, StorageScope.GLOBAL);
		}

		// weekly user event
		if (this.diffInDays(Date.parse(todayString), weeklyLastUseDate) >= 7) {
			// weekly first use
			telemetryService.publicLog('telemetry.weeklyFirstUse', { weeklyFirstUse: true });
			storageService.store('telemetry.weeklyLastUseDate', todayString, StorageScope.GLOBAL);
		}

		// monthly user events
		if (this.diffInDays(Date.parse(todayString), monthlyLastUseDate) >= 30) {
			telemetryService.publicLog('telemetry.monthlyUse', { monthlyFirstUse: true });
			storageService.store('telemetry.monthlyLastUseDate', todayString, StorageScope.GLOBAL);
		}

		/* send monthly uses at the end of month */
		const monthlyUseCount: number = storageService.getNumber('telemetry.monthlyUseCount', StorageScope.GLOBAL, 0);
		let lastMonthDateString: string = storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL, '0');
		let lastMonthDate: Date = new Date(lastMonthDateString);
		if (today.getFullYear() === lastMonthDate.getFullYear()) {
			if (today.getMonth() === lastMonthDate.getMonth()) {
				// if it's the same month
				storageService.store('telemetry.monthlyUseCount', monthlyUseCount+1, StorageScope.GLOBAL);
			} else {
				// otherwise the month changed, so send the monthly count for last month and reset the count for this month
				telemetryService.publicLog('telemetry.monthlyUseCount',
					{ monthlyUseCount: monthlyUseCount, month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString() });

				const wasActiveLastMonth: boolean = storageService.getBoolean('telemetry.wasActiveLastMonth', StorageScope.GLOBAL, false);
				const isActiveThisMonth: boolean = storageService.getNumber('telemetry.monthlyUseCount', StorageScope.GLOBAL, 0) >= 2;
				const isChurnedThisMonth: boolean = wasActiveLastMonth && !isActiveThisMonth;
				const isContinuing: boolean = wasActiveLastMonth && isActiveThisMonth;
				const wasChurnedLastMonth: boolean = storageService.getBoolean('telemetry.wasChurnedLastMonth', StorageScope.GLOBAL, false);
				const isReturning: boolean = wasChurnedLastMonth && isActiveThisMonth;

				if (firstTimeUser) {
					// new user
					telemetryService.publicLog('telemetry.userGrowthType', {
						 userType: 'New', month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString()});
				}

				// if isChurnedThisMonth, set wasChurnedLastMonth
				if (isChurnedThisMonth) {
					// churned user
					telemetryService.publicLog('telemetry.userGrowthType',
						{ userType: 'Churned', month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString()});
					storageService.store('telemetry.wasChurnedLastMonth', true, StorageScope.GLOBAL);
				}

				if (isContinuing) {
					// continuing user
					telemetryService.publicLog('telemetry.userGrowthType',
						{ userType: 'Continuing', month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString()});
				}

				if (isReturning) {
					// returning user
					telemetryService.publicLog('telemetry.userGrowthType',
						{ userType: 'Returning', month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString()});
				}

				// if isActiveThisMonth, set wasActiveUserLastMonth
				if (isActiveThisMonth) {
					storageService.store('telemetry.wasActiveLastMonth', true, StorageScope.GLOBAL);
				}

				// reset the monthly count for the new month
				storageService.store('telemetry.monthlyUseCount', 0, StorageScope.GLOBAL);
			}
		}
	}

	private diffInDays(nowDate: number, lastUseDate: number): number {
		return (nowDate - lastUseDate) / (24 * 3600 * 1000);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SqlTelemetryContribution, LifecyclePhase.Starting);
