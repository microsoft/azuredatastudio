/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities, ServerCapabilities, RPCMessageType, StaticFeature } from 'vscode-languageclient';

import { Disposable } from 'vscode';

import { Telemetry } from './telemetry';
import * as Utils from './utils';
import { TelemetryNotification } from './contracts';

class TelemetryFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(capabilities, 'telemetry')!.telemetry = true;
	}

	initialize(): void {
		const client = this._client;

		client.onNotification(TelemetryNotification.type, e => {
			Telemetry.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
		});
	}
}
