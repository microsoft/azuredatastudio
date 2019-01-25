/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { ITelemetryService, ITelemetryData } from 'vs/platform/telemetry/common/telemetry';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { warn } from 'sql/base/common/log';

export interface IConnectionTelemetryData extends ITelemetryData {
	provider?: string;
}

/**
 * Call the given telemetry service to log the telemetry event.
 * If the provider is not in the data, tries to get it from connection inside the data.
 * The connection in the data won't be included in the telemetry data
 * Note: userId is added to all telemetry events so no need to add it here
 * @param telemetryService Telemetry Service
 * @param telemetryEventName Telemetry event name
 * @param data Telemetry data
 */
export function addTelemetry(
	telemetryService: ITelemetryService,
	telemetryEventName: string,
	data?: IConnectionTelemetryData,
	connection?: IConnectionProfile): Promise<void> {
	return new Promise<void>(resolve => {
		try {
			let telData: ITelemetryData = data === undefined ? {} : data;

			if (telData && telData.provider === undefined) {

				let provider: string = '';
				if (connection) {
					provider = connection.providerName;
				}
				telData.provider = provider;
			}
			delete telData['connection'];
			if (telemetryService) {
				telemetryService.publicLog(telemetryEventName, telData).then(() => {
					resolve();
				}, telemetryServiceError => {
					warn(`Failed to add telemetry. error: ${telemetryServiceError}`);
					resolve();
				});
			} else {
				resolve();
			}
		} catch (error) {
			warn(`Failed to add telemetry. error: ${error}`);
			resolve();
		}
	});
}
