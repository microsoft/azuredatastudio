/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryInfo } from 'vs/platform/telemetry/common/telemetry';

export const IAdsTelemetryService = createDecorator<IAdsTelemetryService>('adsTelemetryService');

/**
 * Holds additional properties to send along with an event.
 */
export interface ITelemetryEventProperties {
	[key: string]: any;
}

/**
 * Holds additional measures to send along with an event.
 */
export interface ITelemetryEventMeasures {
	[key: string]: number;
}

export interface ITelemetryEvent {
	/**
	 * Sends the event
	 */
	send(): void;

	/**
	 * Adds additional custom properties to this event.
	 * @param additionalProperties The additional properties to add
	 */
	withAdditionalProperties(additionalProperties: ITelemetryEventProperties): ITelemetryEvent;

	/**
	 * Adds additional custom measurements to this event.
	 * @param additionalMeasurements The additional measurements to add
	 */
	withAdditionalMeasurements(additionalMeasurements: ITelemetryEventMeasures): ITelemetryEvent;

	/**
	 * Adds additional connection-related information to this event.
	 * @param connectionInfo The connection info to add.
	 */
	withConnectionInfo(connectionInfo?: azdata.IConnectionProfile): ITelemetryEvent;

	/**
	 * Adds additional server-related information to this event.
	 * @param serverInfo The server info to add.
	 */
	withServerInfo(serverInfo?: azdata.ServerInfo): ITelemetryEvent;
}

export interface IAdsTelemetryService {

	// ITelemetryService functions
	_serviceBrand: undefined;

	setEnabled(value: boolean): void;

	getTelemetryInfo(): Promise<ITelemetryInfo>;

	isOptedIn: boolean;

	// Custom event functions
	createViewEvent(view: string): ITelemetryEvent;
	sendViewEvent(view: string): void;
	createActionEvent(view: string, action: string, target?: string, source?: string, durationInMs?: number): ITelemetryEvent;
	sendActionEvent(view: string, action: string, target?: string, source?: string, durationInMs?: number): void;
	createMetricsEvent(metrics: ITelemetryEventMeasures, groupName: string): ITelemetryEvent;
	sendMetricsEvent(metrics: ITelemetryEventMeasures, groupName: string): void;
	createErrorEvent(view: string, name: string, errorCode?: string, errorType?: string): ITelemetryEvent;
	sendErrorEvent(view: string, name: string, errorCode?: string, errorType?: string): void;
	createTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measurements?: ITelemetryEventMeasures): ITelemetryEvent;
	sendTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measurements?: ITelemetryEventMeasures): void;
}
