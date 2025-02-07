/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { localize } from 'vs/nls';

export class RetirementAnnouncement {
	private static DO_NOT_SHOW_RETIREMENT_PROMPT = 'workbench.doNotShowRetirementPrompt';

	constructor(
		@IStorageService private storageService: IStorageService,
		@INotificationService private notificationService: INotificationService,
		@IHostService hostService: IHostService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		if (this.storageService.get(RetirementAnnouncement.DO_NOT_SHOW_RETIREMENT_PROMPT, StorageScope.APPLICATION)) {
			return;
		}

		const retirementNotice = localize('prompt.adsRetirementAnnouncement', "Azure Data Studio will be retired on February 28, 2026.  [Read more](https://aka.ms/ads-retirement)");
		this.notificationService.prompt(
			Severity.Info,
			retirementNotice,
			[
				{
					label: localize('okay', "OK"),
					run: () => { /* no-op, just an ack */ }
				},
				{
					label: localize('never', "Don't show again"),
					run: () => {
						this.storageService.store(RetirementAnnouncement.DO_NOT_SHOW_RETIREMENT_PROMPT, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
					}
				}
			]
		);
	}

}
