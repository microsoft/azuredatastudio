/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature } from 'vscode-languageclient';
import { TelemetryReporter } from '../telemetry';
import * as contracts from './contracts';
import * as Utils from '../utils';

export class TelemetryFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(capabilities, 'telemetry')!.telemetry = true;
	}

	initialize(): void {
		this._client.onNotification(contracts.TelemetryNotification.type, e => {
			TelemetryReporter.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
		});
	}
}
