/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { resolveCommonProperties } from 'vs/platform/telemetry/node/commonProperties';
import { instanceStorageKey, firstSessionDateStorageKey, lastSessionDateStorageKey } from 'vs/platform/telemetry/common/telemetry';
import { cleanRemoteAuthority } from 'vs/platform/telemetry/common/telemetryUtils';

import product from 'vs/platform/product/node/product'; // {{ SQL CARBON EDIT }}

export async function resolveWorkbenchCommonProperties(storageService: IStorageService, commit: string | undefined, version: string | undefined, machineId: string, msftInternalDomains: string[] | undefined, installSourcePath: string, remoteAuthority?: string): Promise<{ [name: string]: string | boolean | undefined }> {
	const result = await resolveCommonProperties(commit, version, machineId, msftInternalDomains, installSourcePath);
	const instanceId = storageService.get(instanceStorageKey, StorageScope.GLOBAL)!;
	const firstSessionDate = storageService.get(firstSessionDateStorageKey, StorageScope.GLOBAL)!;
	const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.GLOBAL)!;

	if (product.quality !== 'stable') {
		// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.shell'] = process.versions && process.versions['electron'];
		// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.version.renderer'] = process.versions && process.versions['chrome'];
		// __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		result['common.firstSessionDate'] = firstSessionDate;
		// __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		result['common.lastSessionDate'] = lastSessionDate || '';
		// __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
		// __GDPR__COMMON__ "common.instanceId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		result['common.instanceId'] = instanceId;
		// __GDPR__COMMON__ "common.remoteAuthority" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		result['common.remoteAuthority'] = cleanRemoteAuthority(remoteAuthority);
	} else {
		// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		// result['common.version.shell'] = process.versions && process.versions['electron'];
		// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		// result['common.version.renderer'] = process.versions && process.versions['chrome'];
		// __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.firstSessionDate'] = firstSessionDate;
		// __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.lastSessionDate'] = lastSessionDate || '';
		// __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
		// __GDPR__COMMON__ "common.instanceId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		// result['common.instanceId'] = instanceId;
		// __GDPR__COMMON__ "common.remoteAuthority" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
		// result['common.remoteAuthority'] = cleanRemoteAuthority(remoteAuthority);

		result['common.userId'] = ''; // {{SQL CARBON EDIT}}
	}

	result['common.application.name'] = product.nameLong; // {{SQL CARBON EDIT}}
	setUsageDates(storageService);

	return result;
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
