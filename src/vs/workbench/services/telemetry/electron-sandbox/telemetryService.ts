/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryService, ITelemetryInfo, ITelemetryData, TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { supportsTelemetry, NullTelemetryService, getPiiPathsFromEnvironment, isInternalTelemetry } from 'vs/platform/telemetry/common/telemetryUtils';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Disposable } from 'vs/base/common/lifecycle';
import { INativeWorkbenchEnvironmentService } from 'vs/workbench/services/environment/electron-sandbox/environmentService';
import { IProductService } from 'vs/platform/product/common/productService';
import { ISharedProcessService } from 'vs/platform/ipc/electron-sandbox/services';
import { TelemetryAppenderClient } from 'vs/platform/telemetry/common/telemetryIpc';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { resolveWorkbenchCommonProperties } from 'vs/workbench/services/telemetry/electron-sandbox/workbenchCommonProperties';
import { TelemetryService as BaseTelemetryService, ITelemetryServiceConfig } from 'vs/platform/telemetry/common/telemetryService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ClassifiedEvent, StrictPropertyCheck, GDPRClassification } from 'vs/platform/telemetry/common/gdprTypings';
import { IFileService } from 'vs/platform/files/common/files';
import { IObservableValue } from 'vs/base/common/observableValue';

export class TelemetryService extends Disposable implements ITelemetryService {

	declare readonly _serviceBrand: undefined;

	private impl: ITelemetryService;
	public readonly sendErrorTelemetry: boolean;

	constructor(
		@INativeWorkbenchEnvironmentService environmentService: INativeWorkbenchEnvironmentService,
		@IProductService productService: IProductService,
		@ISharedProcessService sharedProcessService: ISharedProcessService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService configurationService: IConfigurationService,
		@IFileService fileService: IFileService
	) {
		super();

		if (supportsTelemetry(productService, environmentService)) {
			const isInternal = isInternalTelemetry(productService, configurationService);
			const channel = sharedProcessService.getChannel('telemetryAppender');
			const config: ITelemetryServiceConfig = {
				appenders: [new TelemetryAppenderClient(channel)],
				commonProperties: resolveWorkbenchCommonProperties(storageService, fileService, environmentService.os.release, environmentService.os.hostname, productService.commit, productService.version, environmentService.machineId, isInternal, environmentService.installSourcePath, environmentService.remoteAuthority),
				piiPaths: getPiiPathsFromEnvironment(environmentService),
				sendErrorTelemetry: true
			};

			this.impl = this._register(new BaseTelemetryService(config, configurationService, productService));
		} else {
			this.impl = NullTelemetryService;
		}

		this.sendErrorTelemetry = this.impl.sendErrorTelemetry;
	}

	setExperimentProperty(name: string, value: string): void {
		return this.impl.setExperimentProperty(name, value);
	}

	get telemetryLevel(): IObservableValue<TelemetryLevel> {
		return this.impl.telemetryLevel;
	}

	publicLog(eventName: string, data?: ITelemetryData, anonymizeFilePaths?: boolean): Promise<void> {
		return this.impl.publicLog(eventName, data, anonymizeFilePaths);
	}

	publicLog2<E extends ClassifiedEvent<T> = never, T extends GDPRClassification<T> = never>(eventName: string, data?: StrictPropertyCheck<T, E>, anonymizeFilePaths?: boolean) {
		return this.publicLog(eventName, data as ITelemetryData, anonymizeFilePaths);
	}

	publicLogError(errorEventName: string, data?: ITelemetryData): Promise<void> {
		return this.impl.publicLogError(errorEventName, data);
	}

	publicLogError2<E extends ClassifiedEvent<T> = never, T extends GDPRClassification<T> = never>(eventName: string, data?: StrictPropertyCheck<T, E>) {
		return this.publicLog(eventName, data as ITelemetryData);
	}


	getTelemetryInfo(): Promise<ITelemetryInfo> {
		return this.impl.getTelemetryInfo();
	}
}

registerSingleton(ITelemetryService, TelemetryService);
