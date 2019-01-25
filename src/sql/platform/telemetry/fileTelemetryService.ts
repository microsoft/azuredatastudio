/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { ITelemetryService, ITelemetryInfo, ITelemetryData } from 'vs/platform/telemetry/common/telemetry';
const fs = require('fs');

/**
 * Write telemetry into a file for test purposes
 */
export class FileTelemetryService implements ITelemetryService {
	_serviceBrand: undefined;
	private _isFirst = true;

	constructor(private _outputFile: string) {
	}

	publicLog(eventName: string, data?: ITelemetryData) {
		let telemetryData = JSON.stringify(Object.assign({ eventName: eventName, data: data }));
		if (this._outputFile) {
			if (this._isFirst) {
				fs.open(this._outputFile, fs.O_WRONLY | fs.O_CREAT, (err, fr) => {
					fs.writeFileSync(this._outputFile, telemetryData + '\n');
					this._isFirst = false;
				});
			} else {
				fs.appendFileSync(this._outputFile, telemetryData + '\n');
			}
		}
		return TPromise.wrap<void>(null);
	}
	isOptedIn: true;
	getTelemetryInfo(): TPromise<ITelemetryInfo> {
		return TPromise.wrap({
			instanceId: 'someValue.instanceId',
			sessionId: 'someValue.sessionId',
			machineId: 'someValue.machineId'
		});
	}
}
