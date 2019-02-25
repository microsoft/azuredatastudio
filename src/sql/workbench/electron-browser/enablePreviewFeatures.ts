/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IWindowService, IWindowsService } from 'vs/platform/windows/common/windows';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export class EnablePreviewFeatures implements IWorkbenchContribution {

	private static ENABLE_PREVIEW_FEATURES_SHOWN = 'workbench.enablePreviewFeaturesShown';

	constructor(
		@IStorageService storageService: IStorageService,
		@IOpenerService openerService: IOpenerService,
		@INotificationService notificationService: INotificationService,
		@IWindowService windowService: IWindowService,
		@IWindowsService windowsService: IWindowsService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		let previewFeaturesEnabled = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (previewFeaturesEnabled || storageService.get(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, StorageScope.GLOBAL)) {
			return;
		}
		Promise.all([
			windowService.isFocused(),
			windowsService.getWindowCount()
		]).then(([focused, count]) => {
			if (!focused && count > 1) {
				return null;
			}
			configurationService.updateValue('workbench.enablePreviewFeatures', false);

			const enablePreviewFeaturesNotice = localize('enablePreviewFeatures.notice', "Would you like to enable preview features?");
			notificationService.prompt(
				Severity.Info,
				enablePreviewFeaturesNotice,
				[{
					label: localize('enablePreviewFeatures.yes', "Yes"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', true);
						storageService.store(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
					}
				}, {
					label: localize('enablePreviewFeatures.no', "No"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', false);
					}
				}, {
					label: localize('enablePreviewFeatures.never', "No, don't show again"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', false);
						storageService.store(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
					},
					isSecondary: true
				}]
			);
		})
			.then(null, onUnexpectedError);
	}
}
