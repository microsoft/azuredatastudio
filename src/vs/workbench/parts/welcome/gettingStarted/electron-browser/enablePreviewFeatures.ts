/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

// TODO: Move this to sql code

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import product from 'vs/platform/node/product';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import URI from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IWindowService, IWindowsService } from 'vs/platform/windows/common/windows';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration';

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
		if (previewFeaturesEnabled || storageService.get(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN)) {
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
			storageService.store(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true);

			const enablePreviewFeaturesNotice = localize('enablePreviewFeatures.notice', "Unreleased preview features like backup/restore, query plan, and dashboard extension tabs are disabled by default. Enable them?");
			notificationService.prompt(
				Severity.Info,
				enablePreviewFeaturesNotice,
				[{
					label: localize('enablePreviewFeatures.enable', "Enable preview features"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', true);
					}
				}]
			);
		})
			.then(null, onUnexpectedError);
	}
}
