/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { ILifecycleMainService } from 'vs/platform/lifecycle/electron-main/lifecycleMainService';
import { ILogService } from 'vs/platform/log/common/log';
import { INativeHostMainService } from 'vs/platform/native/electron-main/nativeHostMainService';
import { IProductService } from 'vs/platform/product/common/productService';
import { asJson, IRequestService } from 'vs/platform/request/common/request';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { AvailableForDownload, Build, IUpdate, State, UpdateType } from 'vs/platform/update/common/update';
import { AbstractUpdateService, createUpdateURL, UpdateNotAvailableClassification } from 'vs/platform/update/electron-main/abstractUpdateService';

function getUpdateFromBuild(build: Build | null, productService: IProductService): IUpdate | undefined {
	if (!build) {
		return undefined;
	}

	if (build.id === productService.commit) {
		return undefined;
	}

	const platform = `linux-${process.arch}`;
	const assetType = build.updates[platform];
	const asset = build.assets.filter(a => a.platform === platform && a.type === assetType)[0];

	if (!asset) {
		return undefined;
	}

	const url = asset.url;
	return {
		url: url,
		version: build.id,
		productVersion: build.version,
		hash: asset.hash,
	};
}


export class LinuxUpdateService extends AbstractUpdateService {

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@INativeHostMainService private readonly nativeHostMainService: INativeHostMainService,
		@IProductService productService: IProductService
	) {
		super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService);
	}

	protected buildUpdateFeedUrl(quality: string): string {
		return createUpdateURL(`linux-${process.arch}`, quality, this.productService);
	}

	protected doCheckForUpdates(context: any): void {
		if (!this.url) {
			return;
		}

		this.setState(State.CheckingForUpdates(context));
		this.requestService.request({ url: 'https://go.microsoft.com/fwlink/?linkid=2274438' }, CancellationToken.None)
			.then<Build | null>(asJson)
			.then(build => {
				const update = getUpdateFromBuild(build, this.productService);
				if (!update || !update.url || !update.version || !update.productVersion) {
					this.telemetryService.publicLog2<{ explicit: boolean }, UpdateNotAvailableClassification>('update:notAvailable', { explicit: !!context });

					this.setState(State.Idle(UpdateType.Archive));
				} else {
					this.setState(State.AvailableForDownload(update));
				}
			})
			.then(undefined, err => {
				this.logService.error(err);
				this.telemetryService.publicLog2<{ explicit: boolean }, UpdateNotAvailableClassification>('update:notAvailable', { explicit: !!context });
				// only show message when explicitly checking for updates
				const message: string | undefined = !!context ? (err.message || err) : undefined;
				this.setState(State.Idle(UpdateType.Archive, message));
			});
	}

	protected override async doDownloadUpdate(state: AvailableForDownload): Promise<void> {
		// Use the download URL if available as we don't currently detect the package type that was
		// installed and the website download page is more useful than the tarball generally.
		if (this.productService.downloadUrl && this.productService.downloadUrl.length > 0) {
			this.nativeHostMainService.openExternal(undefined, this.productService.downloadUrl);
		} else if (state.update.url) {
			this.nativeHostMainService.openExternal(undefined, state.update.url);
		}

		this.setState(State.Idle(UpdateType.Archive));
	}
}
