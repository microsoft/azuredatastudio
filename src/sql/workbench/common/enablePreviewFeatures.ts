/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IHostService } from 'vs/workbench/services/host/browser/host';

export abstract class AbstractEnablePreviewFeatures implements IWorkbenchContribution {

	private static ENABLE_PREVIEW_FEATURES_SHOWN = 'workbench.enablePreviewFeaturesShown';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@IHostService private readonly hostService: IHostService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) { }

	protected handlePreviewFeatures(): void {
		let previewFeaturesEnabled = this.configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (previewFeaturesEnabled || this.storageService.get(AbstractEnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, StorageScope.GLOBAL)) {
			return;
		}
		Promise.all([
			this.hostService.hasFocus,
			this.getWindowCount()
		]).then(async ([focused, count]) => {
			if (!focused && count > 1) {
				return null;
			}
			await this.configurationService.updateValue('workbench.enablePreviewFeatures', false);

			const enablePreviewFeaturesNotice = localize('enablePreviewFeatures.notice', "Preview features are required in order for extensions to be fully supported and for some actions to be available.  Would you like to enable preview features?");
			this.notificationService.prompt(
				Severity.Info,
				enablePreviewFeaturesNotice,
				[{
					label: localize('enablePreviewFeatures.yes', "Yes"),
					run: () => {
						this.configurationService.updateValue('workbench.enablePreviewFeatures', true).catch(e => onUnexpectedError(e));
						this.storageService.store(AbstractEnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
					}
				}, {
					label: localize('enablePreviewFeatures.no', "No"),
					run: () => {
						this.configurationService.updateValue('workbench.enablePreviewFeatures', false).catch(e => onUnexpectedError(e));
					}
				}, {
					label: localize('enablePreviewFeatures.never', "No, don't show again"),
					run: () => {
						this.configurationService.updateValue('workbench.enablePreviewFeatures', false).catch(e => onUnexpectedError(e));
						this.storageService.store(AbstractEnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
					},
					isSecondary: true
				}]
			);
		}).catch(e => onUnexpectedError(e));
	}

	protected abstract getWindowCount(): Promise<number>;
}
