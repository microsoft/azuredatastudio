/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import URI from 'vs/base/common/uri';
import { IWindowService, IWindowsService } from 'vs/platform/windows/common/windows';

export class UpgradeToAzureDataStudio implements IWorkbenchContribution {
	private static AzureDataStudioDownloadLink = 'https://go.microsoft.com/fwlink/?linkid=2049035';
	private static AzureDataStudioMoreInfoLink = 'https://go.microsoft.com/fwlink/?linkid=2048944';

	constructor(
		@IOpenerService openerService: IOpenerService,
		@INotificationService notificationService: INotificationService,
		@IWindowService windowService: IWindowService,
		@IWindowsService windowsService: IWindowsService,
	) {
		Promise.all([
			windowService.isFocused(),
			windowsService.getWindowCount()
		]).then(([focused, count]) => {
			if (!focused && count > 1) {
				return null;
			}

			notificationService.prompt(
				Severity.Info,
				'SQL Operations Studio Preview will no longer receive future updates.  Please download Azure Data Studio for the latest enhancements and bug fixes.  ' +
				'Upgrading to Azure Data Studio is a 1-time manual process.',
				[{
					label: 'Download Now',
					run: () => openerService.open(URI.parse(UpgradeToAzureDataStudio.AzureDataStudioDownloadLink))
				},
				{
					label: 'More Info',
					run: () => openerService.open(URI.parse(UpgradeToAzureDataStudio.AzureDataStudioMoreInfoLink))
				}]
			);
		});
	}
}
