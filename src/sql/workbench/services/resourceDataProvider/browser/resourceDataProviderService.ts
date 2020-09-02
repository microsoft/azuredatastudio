/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IResourceDataProviderService } from 'sql/workbench/services/resourceDataProvider/common/resourceDataProviderService';
import { invalidProvider } from 'sql/base/common/errors';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

export class ResourceDataProviderService implements IResourceDataProviderService {

	public _serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.ResourceDataProvider<any>; } = Object.create(null);

	constructor(
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
	}

	/**
	 * Register a resource data provider
	 */
	public registerProvider<T extends azdata.Resource>(providerId: string, provider: azdata.ResourceDataProvider<T>): void {
		this._providers[providerId] = provider;
	}

	public unregisterProvider(providerId: string): void {
		delete this._providers[providerId];
	}

	public async getResources<T extends azdata.Resource>(providerId: string): Promise<T[]> {
		const provider = this._providers[providerId];
		if (provider) {
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.FirewallRuleRequested)
				.withAdditionalProperties({
					provider: providerId
				}).send();
			return provider.getResources();
		} else {
			throw invalidProvider(providerId);
		}
	}
}
