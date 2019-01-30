/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as uuid from 'vs/base/common/uuid';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { resolveCommonProperties } from 'vs/platform/telemetry/node/commonProperties';

export const lastSessionDateStorageKey = 'telemetry.lastSessionDate';

// {{ SQL CARBON EDIT }}
import product from 'vs/platform/node/product';
import * as Utils from 'sql/common/telemetryUtilities';

export function resolveWorkbenchCommonProperties(storageService: IStorageService, commit: string, version: string, machineId: string, installSourcePath: string): Promise<{ [name: string]: string }> {
	return resolveCommonProperties(commit, version, machineId, installSourcePath).then(result => {
		// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.shell'] = process.versions && process.versions['electron'];
		// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.renderer'] = process.versions && process.versions['chrome'];
		// {{SQL CARBON EDIT}}
		result['common.application.name'] = product.nameLong;
		// {{SQL CARBON EDIT}}
		result['common.userId'] = '';

		// {{SQL CARBON EDIT}}
		// const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.GLOBAL);
		// if (!process.env['VSCODE_TEST_STORAGE_MIGRATION']) {
		// 	storageService.store(lastSessionDateStorageKey, new Date().toUTCString(), StorageScope.GLOBAL);
		// }

		// {{SQL CARBON EDIT}}
		// // __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.firstSessionDate'] = getOrCreateFirstSessionDate(storageService);
		// // __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.lastSessionDate'] = lastSessionDate || '';
		// // __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
		// // __GDPR__COMMON__ "common.instanceId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.instanceId'] = getOrCreateInstanceId(storageService);

		// {{SQL CARBON EDIT}}
		setUsageDates(storageService);
		return result;
	});
}

// {{SQL CARBON EDIT}}
// function getOrCreateInstanceId(storageService: IStorageService): string {
// 	const key = 'telemetry.instanceId';

// 	let instanceId = storageService.get(key, StorageScope.GLOBAL, void 0);
// 	if (instanceId) {
// 		return instanceId;
// 	}

// 	instanceId = uuid.generateUuid();
// 	storageService.store(key, instanceId, StorageScope.GLOBAL);

// 	return instanceId;
// }

function getOrCreateFirstSessionDate(storageService: IStorageService): string {
	const key = 'telemetry.firstSessionDate';

	let firstSessionDate = storageService.get(key, StorageScope.GLOBAL, void 0);
	if (firstSessionDate) {
		return firstSessionDate;
	}

	firstSessionDate = new Date().toUTCString();
	storageService.store(key, firstSessionDate, StorageScope.GLOBAL);

	return firstSessionDate;
}

// {{SQL CARBON EDIT}}
function setUsageDates(storageService: IStorageService): void {
	// daily last usage date
	const appStartDate = new Date('January 1, 2000');
	const dailyLastUseDate = storageService.get('telemetry.dailyLastUseDate', StorageScope.GLOBAL) || appStartDate;
	storageService.store('telemetry.dailyLastUseDate', dailyLastUseDate, StorageScope.GLOBAL);

	// weekly last usage date
	const weeklyLastUseDate = storageService.get('telemetry.weeklyLastUseDate', StorageScope.GLOBAL) || appStartDate;
	storageService.store('telemetry.weeklyLastUseDate', weeklyLastUseDate, StorageScope.GLOBAL);

	// monthly last usage date
	const monthlyLastUseDate = storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL) || appStartDate;
	storageService.store('telemetry.monthlyLastUseDate', monthlyLastUseDate, StorageScope.GLOBAL);

}
