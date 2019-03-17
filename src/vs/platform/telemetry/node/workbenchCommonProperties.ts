/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { resolveCommonProperties } from 'vs/platform/telemetry/node/commonProperties';

export const lastSessionDateStorageKey = 'telemetry.lastSessionDate';

// {{ SQL CARBON EDIT }}
import product from 'vs/platform/node/product';

export function resolveWorkbenchCommonProperties(storageService: IStorageService, commit: string, version: string, machineId: string, installSourcePath: string): Promise<{ [name: string]: string | undefined }> {
	return resolveCommonProperties(commit, version, machineId, installSourcePath).then(result => {
		const instanceId = storageService.get('telemetry.instanceId', StorageScope.GLOBAL)!;
		const firstSessionDate = storageService.get('telemetry.firstSessionDate', StorageScope.GLOBAL)!;
		const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.GLOBAL)!;

		// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.shell'] = process.versions && process.versions['electron'];
		// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.renderer'] = process.versions && process.versions['chrome'];
		// {{SQL CARBON EDIT}}
		result['common.application.name'] = product.nameLong;
		// {{SQL CARBON EDIT}}
		result['common.userId'] = '';

		// {{SQL CARBON EDIT}}
		// // __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.firstSessionDate'] = firstSessionDate;
		// // __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.lastSessionDate'] = lastSessionDate || '';
		// // __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
		// // __GDPR__COMMON__ "common.instanceId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.instanceId'] = instanceId;

		// {{SQL CARBON EDIT}}
		setUsageDates(storageService);
		return result;
	});
}

// {{SQL CARBON EDIT}}
function setUsageDates(storageService: IStorageService): void {
	// daily last usage date
	const appStartDate = new Date('January 1, 2000');
	const dailyLastUseDate = storageService.get('telemetry.dailyLastUseDate', StorageScope.GLOBAL, appStartDate.toUTCString());
	storageService.store('telemetry.dailyLastUseDate', dailyLastUseDate, StorageScope.GLOBAL);

	// weekly last usage date
	const weeklyLastUseDate = storageService.get('telemetry.weeklyLastUseDate', StorageScope.GLOBAL, appStartDate.toUTCString());
	storageService.store('telemetry.weeklyLastUseDate', weeklyLastUseDate, StorageScope.GLOBAL);

	// monthly last usage date
	const monthlyLastUseDate = storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL, appStartDate.toUTCString());
	storageService.store('telemetry.monthlyLastUseDate', monthlyLastUseDate, StorageScope.GLOBAL);

}
