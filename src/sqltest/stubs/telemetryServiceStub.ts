/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITelemetryService, ITelemetryData, ITelemetryInfo } from 'vs/platform/telemetry/common/telemetry';
import { TPromise } from 'vs/base/common/winjs.base';

// Test stubs for commonly used objects

export class TelemetryServiceStub implements ITelemetryService {

	_serviceBrand: any;

	/**
	 * Sends a telemetry event that has been privacy approved.
	 * Do not call this unless you have been given approval.
	 */
	publicLog(eventName: string, data?: ITelemetryData): TPromise<void> {
		return undefined;
	}

	getTelemetryInfo(): TPromise<ITelemetryInfo> {
		return undefined;
	}

	isOptedIn: boolean;
}