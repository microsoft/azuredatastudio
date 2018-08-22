/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import * as uuid from 'vs/base/common/uuid';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { resolveCommonProperties } from '../node/commonProperties';

// {{ SQL CARBON EDIT }}
import product from 'vs/platform/node/product';
import * as Utils from 'sql/common/telemetryUtilities';

export function resolveWorkbenchCommonProperties(storageService: IStorageService, commit: string, version: string, machineId: string, installSourcePath: string): TPromise<{ [name: string]: string }> {
	return resolveCommonProperties(commit, version, machineId, installSourcePath).then(result => {
		// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.shell'] = process.versions && (<any>process).versions['electron'];
		// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.renderer'] = process.versions && (<any>process).versions['chrome'];
		// {{SQL CARBON EDIT}}
		result['common.application.name'] = product.nameLong;
		// {{SQL CARBON EDIT}}
		result['common.userId'] = '';

		// {{SQL CARBON EDIT}}
		// const lastSessionDate = storageService.get('telemetry.lastSessionDate');
		// const firstSessionDate = storageService.get('telemetry.firstSessionDate') || new Date().toUTCString();
		// storageService.store('telemetry.firstSessionDate', firstSessionDate);
		// storageService.store('telemetry.lastSessionDate', new Date().toUTCString());

		// // __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.firstSessionDate'] = firstSessionDate;
		// // __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.lastSessionDate'] = lastSessionDate;
		// // __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.isNewSession'] = !lastSessionDate ? '1' : '0';

		// {{SQL CARBON EDIT}}
		// __GDPR__COMMON__ "common.instanceId" : { "classification": "EndUserPseudonymizedInformation", "purpose": "FeatureInsight" }
		// result['common.instanceId'] = getOrCreateInstanceId(storageService);
		result['common.instanceId'] = '';

		// {{SQL CARBON EDIT}}
		setUsageDates(storageService);
		return result;
	});
}

// {{SQL CARBON EDIT}}
// function getOrCreateInstanceId(storageService: IStorageService): string {
// 	const result = storageService.get('telemetry.instanceId') || uuid.generateUuid();
// 	storageService.store('telemetry.instanceId', result);
// 	return result;
// }

// {{SQL CARBON EDIT}}
function setUsageDates(storageService: IStorageService): void {
	// daily last usage date
	const appStartDate = new Date('January 1, 2000');
	const dailyLastUseDate = storageService.get('telemetry.dailyLastUseDate') || appStartDate;
	storageService.store('telemetry.dailyLastUseDate', dailyLastUseDate);

	// weekly last usage date
	const weeklyLastUseDate = storageService.get('telemetry.weeklyLastUseDate') || appStartDate;
	storageService.store('telemetry.weeklyLastUseDate', weeklyLastUseDate);

	// monthly last usage date
	const monthlyLastUseDate = storageService.get('telemetry.monthlyLastUseDate') || appStartDate;
	storageService.store('telemetry.monthlyLastUseDate', monthlyLastUseDate);

}