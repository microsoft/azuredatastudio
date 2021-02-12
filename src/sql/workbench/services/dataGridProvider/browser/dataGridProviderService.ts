/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IDataGridProviderService } from 'sql/workbench/services/dataGridProvider/common/dataGridProviderService';
import { invalidProvider } from 'sql/base/common/errors';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

export class DataGridProviderService implements IDataGridProviderService {

	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.DataGridProvider>();

	constructor(
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) { }

	/**
	 * Register a data grid provider
	 */
	public registerProvider(providerId: string, provider: azdata.DataGridProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`A DataGridProvider with id "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	public async getDataGridItems(providerId: string): Promise<azdata.DataGridItem[]> {
		const provider = this._providers.get(providerId);
		if (provider) {
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.GetDataGridItems)
				.withAdditionalProperties({
					provider: providerId
				}).send();
			return provider.getDataGridItems();
		}
		throw invalidProvider(providerId);
	}

	public async getDataGridColumns(providerId: string): Promise<azdata.DataGridColumn[]> {
		const provider = this._providers.get(providerId);
		if (provider) {
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.GetDataGridColumns)
				.withAdditionalProperties({
					provider: providerId
				}).send();
			return provider.getDataGridColumns();
		}
		throw invalidProvider(providerId);
	}
}
