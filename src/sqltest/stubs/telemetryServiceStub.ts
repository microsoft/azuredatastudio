/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITelemetryService, ITelemetryData, ITelemetryInfo } from 'vs/platform/telemetry/common/telemetry';
import { ClassifiedEvent, GDPRClassification, StrictPropertyCheck } from 'vs/platform/telemetry/common/gdprTypings';

// Test stubs for commonly used objects

export class TelemetryServiceStub implements ITelemetryService {
	setEnabled(value: boolean): void {
		// no op;
	}

	_serviceBrand: any;

	/**
	 * Sends a telemetry event that has been privacy approved.
	 * Do not call this unless you have been given approval.
	 */
	publicLog(eventName: string, data?: ITelemetryData): Promise<void> {
		return undefined;
	}

	publicLog2<E extends ClassifiedEvent<T> = never, T extends GDPRClassification<T> = never>(eventName: string, data?: StrictPropertyCheck<T, E>, anonymizeFilePaths?: boolean): Promise<void> {
		return undefined;
	}

	getTelemetryInfo(): Promise<ITelemetryInfo> {
		return undefined;
	}

	isOptedIn: boolean;
}
