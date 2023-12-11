/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IProductService } from 'vs/platform/product/common/productService';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { AbstractTelemetryOptOut } from 'sql/workbench/contrib/telemetry/browser/telemetryOptOut';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INativeHostService } from 'vs/platform/native/common/native';

export class NativeTelemetryOptOut extends AbstractTelemetryOptOut {

	constructor(
		@IStorageService storageService: IStorageService,
		@IOpenerService openerService: IOpenerService,
		@INotificationService notificationService: INotificationService,
		@IHostService hostService: IHostService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IProductService productService: IProductService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@INativeHostService private readonly nativeHostService: INativeHostService
	) {
		super(storageService, openerService, notificationService, hostService, telemetryService, productService, environmentService);

		this.handleTelemetryOptOut();
	}

	protected getWindowCount(): Promise<number> {
		return this.nativeHostService ? this.nativeHostService.getWindowCount() : Promise.resolve(0);
	}
}
