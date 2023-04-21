/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES } from 'sql/workbench/common/constants';

export abstract class AbstractEnablePreviewFeatures implements IWorkbenchContribution {

	private static ENABLE_PREVIEW_FEATURES_SHOWN = 'workbench.enablePreviewFeaturesShown';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@IHostService private readonly hostService: IHostService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) { }

	protected handlePreviewFeatures(): void {
		let previewFeaturesEnabled = this.configurationService.getValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES);
		if (previewFeaturesEnabled || this.storageService.get(AbstractEnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, StorageScope.APPLICATION)) {
			return;
		}
		Promise.all([
			this.hostService.hasFocus,
			this.getWindowCount()
		]).then(async ([focused, count]) => {
			if (!focused && count > 1) {
				return null;
			}
			await this.configurationService.updateValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES, false);

			const enablePreviewFeaturesNotice = localize('enablePreviewFeatures.notice', "Preview features enhance your experience in Azure Data Studio by giving you full access to new features and improvements. You can learn more about preview features [here]({0}). Would you like to enable preview features?", 'https://aka.ms/ads-preview-features');
			this.notificationService.prompt(
				Severity.Info,
				enablePreviewFeaturesNotice,
				[{
					label: localize('enablePreviewFeatures.yes', "Yes (recommended)"),
					run: () => {
						this.configurationService.updateValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES, true).catch(e => onUnexpectedError(e));
						this.storageService.store(AbstractEnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
					}
				}, {
					label: localize('enablePreviewFeatures.no', "No"),
					run: () => {
						this.configurationService.updateValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES, false).catch(e => onUnexpectedError(e));
					}
				}, {
					label: localize('enablePreviewFeatures.never', "No, don't show again"),
					run: () => {
						this.configurationService.updateValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES, false).catch(e => onUnexpectedError(e));
						this.storageService.store(AbstractEnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
					},
					isSecondary: true
				}]
			);
		}).catch(e => onUnexpectedError(e));
	}

	protected abstract getWindowCount(): Promise<number>;
}
