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
		@ITelemetryService private telemetryService: ITelemetryService,
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
		if (this.diffInHours(Date.parse(todayString), dailyLastUseDate) >= 24) {
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


		/* send monthly uses at the end of month */
		const monthlyUseCount: number = storageService.getNumber('telemetry.monthlyUseCount', StorageScope.GLOBAL, 0);
		if (this.diffInDays(Date.parse(todayString), monthlyLastUseDate) >= 30) {
			telemetryService.publicLog('telemetry.monthlyUse', { monthlyFirstUse: true });
			// the month changed, so send the user usage type event based on monthly count for last month
			// and reset the count for this month
			let lastMonthDate = new Date(monthlyLastUseDate);
			this.sendUsageEvent(monthlyUseCount, lastMonthDate);

			const wasActiveLastMonth: boolean = storageService.getBoolean('telemetry.wasActiveLastMonth', StorageScope.GLOBAL, false);
			const isContinuing: boolean = wasActiveLastMonth;
			const isReturning: boolean = !wasActiveLastMonth;

			if (firstTimeUser) {
				// new user
				this.sendGrowthEvent(UserGrowthType.NewUser, lastMonthDate);
			}

			if (isContinuing) {
				// continuing user
				this.sendGrowthEvent(UserGrowthType.ContinuingUser, lastMonthDate);
			}

			if (isReturning) {
				// returning user
				this.sendGrowthEvent(UserGrowthType.ReturningUser, lastMonthDate);
			}

			// set wasActiveUserLastMonth
			storageService.store('telemetry.wasActiveLastMonth', true, StorageScope.GLOBAL);

			// reset the monthly count for the new month
			storageService.store('telemetry.monthlyUseCount', 0, StorageScope.GLOBAL);
			storageService.store('telemetry.monthlyLastUseDate', todayString, StorageScope.GLOBAL);
		} else {
			// if it's the same month, increment the monthly use count
			storageService.store('telemetry.monthlyUseCount', monthlyUseCount+1, StorageScope.GLOBAL);
		}
	}

	private diffInHours(nowDate: number, lastUseDate: number): number {
		return (nowDate - lastUseDate) / (3600 * 1000);
	}

	private diffInDays(nowDate: number, lastUseDate: number): number {
		return this.diffInHours(nowDate, lastUseDate)/24;
	}


	// Usage Metrics
	private sendUsageEvent(monthlyUseCount: number, lastMonthDate: Date): void {
		let userUsageType: UserUsageType;
		if (monthlyUseCount === 1) {
			userUsageType = UserUsageType.TireKicker;
		} else if (monthlyUseCount >= 2 && monthlyUseCount <= 11) {
			userUsageType = UserUsageType.Occasional;
		} else if (monthlyUseCount >= 12 && monthlyUseCount <= 20) {
			userUsageType = UserUsageType.Engaged;
		} else if (monthlyUseCount > 20) {
			userUsageType = UserUsageType.Dedicated;
		}
		this.telemetryService.publicLog('telemetry.userUsage',
		{ userType: userUsageType, monthlyUseCount: monthlyUseCount, month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString() });
	}

	// Growth Metrics
	private sendGrowthEvent(growthType: UserGrowthType, lastMonthDate: Date): void {
		this.telemetryService.publicLog('telemetry.userGrowthType', {
			userGrowthType: growthType, month: lastMonthDate.getMonth().toString(), year: lastMonthDate.getFullYear().toString()});
	}
}

/* Growth Metrics */
// Active here means opened app atleast 1 time in a month
export enum UserGrowthType {
	// first time opening app
	NewUser = 1,
	// was active before, wasn't active last month, but is active this month
	ReturningUser = 2,
	// was active last month and this month
	ContinuingUser = 3
}

// Usage Metrics
export enum UserUsageType {
	/* 1 day per month */
	TireKicker = 1,
	/* 2-11 days per month */
	Occasional = 2,
	/* 12-20 days per month */
	Engaged = 3,
	/* 20+ days per month */
	Dedicated = 4
}
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SqlTelemetryContribution, LifecyclePhase.Starting);
