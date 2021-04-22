/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbstractEnablePreviewFeatures } from 'sql/workbench/contrib/welcome/gettingStarted/browser/abstractEnablePreviewFeatures';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INativeHostService } from 'vs/platform/native/electron-sandbox/native';

export class NativeEnablePreviewFeatures extends AbstractEnablePreviewFeatures {

	constructor(
		@IStorageService storageService: IStorageService,
		@INotificationService notificationService: INotificationService,
		@IHostService hostService: IHostService,
		@IConfigurationService configurationService: IConfigurationService,
		@INativeHostService private readonly electronService: INativeHostService
	) {
		super(storageService, notificationService, hostService, configurationService);

		this.handlePreviewFeatures();
	}

	protected getWindowCount(): Promise<number> {
		return this.electronService.getWindowCount();
	}
}
