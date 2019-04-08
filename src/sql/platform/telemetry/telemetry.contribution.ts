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

		const dailyLastUseDate = Date.parse(storageService.get('telemetry.dailyLastUseDate', StorageScope.GLOBAL, '0'));
		const weeklyLastUseDate = Date.parse(storageService.get('telemetry.weeklyLastUseDate', StorageScope.GLOBAL, '0'));
		const monthlyLastUseDate = Date.parse(storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL, '0'));

		let today = new Date().toUTCString();

		// daily user event
		if (this.diffInDays(Date.parse(today), dailyLastUseDate) >= 1) {
			// daily first use
			telemetryService.publicLog('telemetry.dailyFirstUse', { dailyFirstUse: true });
			storageService.store('telemetry.dailyLastUseDate', today, StorageScope.GLOBAL);
		}

		// weekly user event
		if (this.diffInDays(Date.parse(today), weeklyLastUseDate) >= 7) {
			// weekly first use
			telemetryService.publicLog('telemetry.weeklyFirstUse', { weeklyFirstUse: true });
			storageService.store('telemetry.weeklyLastUseDate', today, StorageScope.GLOBAL);
		}

		// monthly user events
		if (this.diffInDays(Date.parse(today), monthlyLastUseDate) >= 30) {
			telemetryService.publicLog('telemetry.monthlyUse', { monthlyFirstUse: true });
			storageService.store('telemetry.monthlyLastUseDate', today, StorageScope.GLOBAL);
		}

	}

	private diffInDays(nowDate: number, lastUseDate: number): number {
		return (nowDate - lastUseDate) / (24 * 3600 * 1000);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SqlTelemetryContribution, LifecyclePhase.Starting);
