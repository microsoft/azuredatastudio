/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService, TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IProductService } from 'vs/platform/product/common/productService';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { onUnexpectedError } from 'vs/base/common/errors';

export abstract class AbstractTelemetryOptOut implements IWorkbenchContribution {

	private static readonly TELEMETRY_OPT_OUT_SHOWN = 'workbench.telemetryOptOutShown';
	private privacyUrl: string | undefined;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IOpenerService private readonly openerService: IOpenerService,
		@INotificationService private readonly notificationService: INotificationService,
		@IHostService private readonly hostService: IHostService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IProductService private readonly productService: IProductService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService
	) {
	}

	protected async handleTelemetryOptOut(): Promise<void> {
		if (this.productService.telemetryOptOutUrl &&
			!this.storageService.get(AbstractTelemetryOptOut.TELEMETRY_OPT_OUT_SHOWN, StorageScope.APPLICATION) &&
			!this.environmentService.disableTelemetry) {

			const [count] = await Promise.all([this.getWindowCount()]);

			if (!this.hostService.hasFocus && count > 1) {
				return; // return early if meanwhile another window opened (we only show the opt-out once)
			}

			this.storageService.store(AbstractTelemetryOptOut.TELEMETRY_OPT_OUT_SHOWN, true, StorageScope.APPLICATION, StorageTarget.USER);

			this.privacyUrl = this.productService.privacyStatementUrl || this.productService.telemetryOptOutUrl;

			const telemetryOptOutUrl = this.productService.telemetryOptOutUrl;
			if (telemetryOptOutUrl) {
				this.showTelemetryOptOut(telemetryOptOutUrl);
			}
		}
	}

	private showTelemetryOptOut(telemetryOptOutUrl: string): void {
		const optOutNotice = localize('telemetryOptOut.optOutNotice', "Help improve Azure Data Studio by allowing Microsoft to collect usage data. Read our [privacy statement]({0}) and learn how to [opt out]({1}).", this.privacyUrl, this.productService.telemetryOptOutUrl);
		const optInNotice = localize('telemetryOptOut.optInNotice', "Help improve Azure Data Studio by allowing Microsoft to collect usage data. Read our [privacy statement]({0}) and learn how to [opt in]({1}).", this.privacyUrl, this.productService.telemetryOptOutUrl);

		this.notificationService.prompt(
			Severity.Info,
			this.telemetryService.telemetryLevel !== TelemetryLevel.NONE ? optOutNotice : optInNotice,
			[{
				label: localize('telemetryOptOut.readMore', "Read More"),
				run: () => this.openerService.open(URI.parse(telemetryOptOutUrl))
			}],
			{ sticky: true }
		);
	}

	protected abstract getWindowCount(): Promise<number>;
}

export class BrowserTelemetryOptOut extends AbstractTelemetryOptOut {

	constructor(
		@IStorageService storageService: IStorageService,
		@IOpenerService openerService: IOpenerService,
		@INotificationService notificationService: INotificationService,
		@IHostService hostService: IHostService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IProductService productService: IProductService,
		@IEnvironmentService environmentService: IEnvironmentService
	) {
		super(storageService, openerService, notificationService, hostService, telemetryService, productService, environmentService);

		this.handleTelemetryOptOut().catch(onUnexpectedError);
	}

	protected async getWindowCount(): Promise<number> {
		return 1;
	}
}
