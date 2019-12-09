/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'vs/base/common/path';
import * as pfs from 'vs/base/node/pfs';
import { memoize } from 'vs/base/common/decorators';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILifecycleMainService } from 'vs/platform/lifecycle/electron-main/lifecycleMainService';
import product from 'vs/platform/product/common/product';
import { State, IUpdate, StateType, AvailableForDownload, UpdateType } from 'vs/platform/update/common/update';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ILogService } from 'vs/platform/log/common/log';
import { createUpdateURL, AbstractUpdateService, UpdateNotAvailableClassification } from 'vs/platform/update/electron-main/abstractUpdateService';
import { IRequestService, asJson } from 'vs/platform/request/common/request';
import { checksum } from 'vs/base/node/crypto';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { shell } from 'electron';
import { CancellationToken } from 'vs/base/common/cancellation';
import { timeout } from 'vs/base/common/async';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';

async function pollUntil(fn: () => boolean, millis = 1000): Promise<void> {
	while (!fn()) {
		await timeout(millis);
	}
}

interface IAvailableUpdate {
	packagePath: string;
	updateFilePath?: string;
}

let _updateType: UpdateType | undefined = undefined;
function getUpdateType(): UpdateType {
	if (typeof _updateType === 'undefined') {
		_updateType = fs.existsSync(path.join(path.dirname(process.execPath), 'unins000.exe'))
			? UpdateType.Setup
			: UpdateType.Archive;
	}

	return _updateType;
}

export class Win32UpdateService extends AbstractUpdateService {

	_serviceBrand: undefined;

	private availableUpdate: IAvailableUpdate | undefined;

	@memoize
	get cachePath(): Promise<string> {
		// {{SQL CARBON EDIT}}
		const result = path.join(tmpdir(), `sqlops-update-${product.target}-${process.arch}`);
		return pfs.mkdirp(result, undefined).then(() => result);
	}

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IFileService private readonly fileService: IFileService
	) {
		super(lifecycleMainService, configurationService, environmentService, requestService, logService);

		if (getUpdateType() === UpdateType.Setup) {
			/* __GDPR__
				"update:win32SetupTarget" : {
					"target" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
				}
			*/
			/* __GDPR__
				"update:win<NUMBER>SetupTarget" : {
					"target" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
				}
			*/
			telemetryService.publicLog('update:win32SetupTarget', { target: product.target });
		}
	}

	protected buildUpdateFeedUrl(quality: string): string | undefined {
		let platform = 'win32';

		if (process.arch === 'x64') {
			platform += '-x64';
		}

		if (getUpdateType() === UpdateType.Archive) {
			platform += '-archive';
		} else if (product.target === 'user') {
			platform += '-user';
		}

		return createUpdateURL(platform, quality);
	}

	protected doCheckForUpdates(context: any): void {
		if (!this.url) {
			return;
		}

		this.setState(State.CheckingForUpdates(context));

		this.requestService.request({ url: this.url }, CancellationToken.None)
			.then<IUpdate | null>(asJson)
			.then(update => {
				const updateType = getUpdateType();

				if (!update || !update.url || !update.version || !update.productVersion) {
					this.telemetryService.publicLog2<{ explicit: boolean }, UpdateNotAvailableClassification>('update:notAvailable', { explicit: !!context });

					this.setState(State.Idle(updateType));
					return Promise.resolve(null);
				}

				if (updateType === UpdateType.Archive) {
					this.setState(State.AvailableForDownload(update));
					return Promise.resolve(null);
				}

				this.setState(State.Downloading(update));

				return this.cleanup(update.version).then(() => {
					return this.getUpdatePackagePath(update.version).then(updatePackagePath => {
						return pfs.exists(updatePackagePath).then(exists => {
							if (exists) {
								return Promise.resolve(updatePackagePath);
							}

							const url = update.url;
							const hash = update.hash;
							const downloadPath = `${updatePackagePath}.tmp`;

							return this.requestService.request({ url }, CancellationToken.None)
								.then(context => this.fileService.writeFile(URI.file(downloadPath), context.stream))
								.then(hash ? () => checksum(downloadPath, update.hash) : () => undefined)
								.then(() => pfs.rename(downloadPath, updatePackagePath))
								.then(() => updatePackagePath);
						});
					}).then(packagePath => {
						const fastUpdatesEnabled = this.configurationService.getValue<boolean>('update.enableWindowsBackgroundUpdates');

						this.availableUpdate = { packagePath };

						if (fastUpdatesEnabled && update.supportsFastUpdate) {
							if (product.target === 'user') {
								this.doApplyUpdate();
							} else {
								this.setState(State.Downloaded(update));
							}
						} else {
							this.setState(State.Ready(update));
						}
					});
				});
			})
			.then(undefined, err => {
				this.logService.error(err);
				this.telemetryService.publicLog2<{ explicit: boolean }, UpdateNotAvailableClassification>('update:notAvailable', { explicit: !!context });

				// only show message when explicitly checking for updates
				const message: string | undefined = !!context ? (err.message || err) : undefined;
				this.setState(State.Idle(getUpdateType(), message));
			});
	}

	protected async doDownloadUpdate(state: AvailableForDownload): Promise<void> {
		if (state.update.url) {
			shell.openExternal(state.update.url);
		}
		this.setState(State.Idle(getUpdateType()));
	}

	private async getUpdatePackagePath(version: string): Promise<string> {
		const cachePath = await this.cachePath;
		// {{SQL CARBON EDIT}}
		return path.join(cachePath, `AzureDataStudioSetup-${product.quality}-${version}.exe`);
	}

	private async cleanup(exceptVersion: string | null = null): Promise<any> {
		const filter = exceptVersion ? (one: string) => !(new RegExp(`${product.quality}-${exceptVersion}\\.exe$`).test(one)) : () => true;

		const cachePath = await this.cachePath;
		const versions = await pfs.readdir(cachePath);

		const promises = versions.filter(filter).map(async one => {
			try {
				await pfs.unlink(path.join(cachePath, one));
			} catch (err) {
				// ignore
			}
		});

		await Promise.all(promises);
	}

	protected async doApplyUpdate(): Promise<void> {
		if (this.state.type !== StateType.Downloaded && this.state.type !== StateType.Downloading) {
			return Promise.resolve(undefined);
		}

		if (!this.availableUpdate) {
			return Promise.resolve(undefined);
		}

		const update = this.state.update;
		this.setState(State.Updating(update));

		const cachePath = await this.cachePath;

		this.availableUpdate.updateFilePath = path.join(cachePath, `CodeSetup-${product.quality}-${update.version}.flag`);

		await pfs.writeFile(this.availableUpdate.updateFilePath, 'flag');
		const child = spawn(this.availableUpdate.packagePath, ['/verysilent', `/update="${this.availableUpdate.updateFilePath}"`, '/nocloseapplications', '/mergetasks=runcode,!desktopicon,!quicklaunchicon'], {
			detached: true,
			stdio: ['ignore', 'ignore', 'ignore'],
			windowsVerbatimArguments: true
		});

		child.once('exit', () => {
			this.availableUpdate = undefined;
			this.setState(State.Idle(getUpdateType()));
		});

		const readyMutexName = `${product.win32MutexName}-ready`;
		const mutex = await import('windows-mutex');

		// poll for mutex-ready
		pollUntil(() => mutex.isActive(readyMutexName))
			.then(() => this.setState(State.Ready(update)));
	}

	protected doQuitAndInstall(): void {
		if (this.state.type !== StateType.Ready || !this.availableUpdate) {
			return;
		}

		this.logService.trace('update#quitAndInstall(): running raw#quitAndInstall()');

		if (this.state.update.supportsFastUpdate && this.availableUpdate.updateFilePath) {
			fs.unlinkSync(this.availableUpdate.updateFilePath);
		} else {
			spawn(this.availableUpdate.packagePath, ['/silent', '/mergetasks=runcode,!desktopicon,!quicklaunchicon'], {
				detached: true,
				stdio: ['ignore', 'ignore', 'ignore']
			});
		}
	}

	protected getUpdateType(): UpdateType {
		return getUpdateType();
	}
}
