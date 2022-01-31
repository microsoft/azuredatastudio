/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IAdsTelemetryService, ITelemetryInfo, ITelemetryEvent, ITelemetryEventMeasures, ITelemetryEventProperties } from 'sql/platform/telemetry/common/telemetry';
import { ILogService } from 'vs/platform/log/common/log';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { EventName } from 'sql/platform/telemetry/common/telemetryKeys';


class TelemetryEventImpl implements ITelemetryEvent {
	constructor(
		private _telemetryService: ITelemetryService,
		private _logService: ILogService,
		private _eventName: string,
		private _properties?: ITelemetryEventProperties,
		private _measurements?: ITelemetryEventMeasures) {
		this._properties = _properties || {};
		this._measurements = _measurements || {};
	}

	public send(): void {
		try {
			this._telemetryService.publicLog(this._eventName, { properties: this._properties, measurements: this._measurements });
		}
		catch (e) {
			// We don't want exceptions sending telemetry to break functionality so just log and ignore
			if (this._logService) {
				const msg = e instanceof Error ? e.message : e;
				this._logService.warn(`Error sending ${this._eventName} event ${msg}`);
			}
		}
	}

	public withAdditionalProperties(additionalProperties: ITelemetryEventProperties): ITelemetryEvent {
		Object.assign(this._properties, additionalProperties);
		return this;
	}

	public withAdditionalMeasurements(additionalMeasurements: ITelemetryEventMeasures): ITelemetryEvent {
		Object.assign(this._measurements, additionalMeasurements);
		return this;
	}

	public withConnectionInfo(connectionInfo?: azdata.IConnectionProfile): ITelemetryEvent {
		Object.assign(this._properties,
			{
				authenticationType: connectionInfo?.authenticationType,
				provider: connectionInfo?.providerName
			});
		return this;
	}

	public withServerInfo(serverInfo?: azdata.ServerInfo): ITelemetryEvent {
		Object.assign(this._properties,
			{
				connectionType: serverInfo?.isCloud !== undefined ? (serverInfo.isCloud ? 'Azure' : 'Standalone') : '',
				serverVersion: serverInfo?.serverVersion ?? '',
				serverEdition: serverInfo?.serverEdition ?? '',
				serverEngineEdition: serverInfo?.engineEditionId ?? '',
				isBigDataCluster: serverInfo?.options?.isBigDataCluster ?? false,
			});
		return this;
	}
}

class NullTelemetryEventImpl implements ITelemetryEvent {
	constructor() { }

	public send(): void { }

	public withAdditionalProperties(additionalProperties: ITelemetryEventProperties): ITelemetryEvent { return this; }

	public withAdditionalMeasurements(additionalMeasurements: ITelemetryEventMeasures): ITelemetryEvent { return this; }

	public withConnectionInfo(connectionInfo: azdata.IConnectionProfile): ITelemetryEvent { return this; }

	public withServerInfo(serverInfo: azdata.ServerInfo): ITelemetryEvent { return this; }
}

export class AdsTelemetryService implements IAdsTelemetryService {

	_serviceBrand: undefined;

	constructor(
		@ITelemetryService private telemetryService: ITelemetryService,
		@ILogService private logService: ILogService
	) { }

	setEnabled(value: boolean): void {
		return this.telemetryService.setEnabled(value);
	}

	get isOptedIn(): boolean {
		return this.telemetryService.isOptedIn;
	}

	getTelemetryInfo(): Promise<ITelemetryInfo> {
		return this.telemetryService.getTelemetryInfo();
	}

	/**
	 * Creates a View event that can be sent later. This is used to log that a particular page or item was seen.
	 * @param view The name of the page or item that was viewed
	 */
	public createViewEvent(view: string): ITelemetryEvent {
		return new TelemetryEventImpl(this.telemetryService, this.logService, EventName.View, {
			view: view
		});
	}

	/**
	 * Sends a View event. This is used to log that a particular page or item was seen.
	 * @param view The name of the page or item that was viewed
	 */
	public sendViewEvent(view: string): void {
		this.createViewEvent(view).send();
	}

	/**
	 * Creates an Action event that can be sent later. This is used to log when an action was taken, such as clicking a button.
	 * @param view The name of the page or item where this action occurred
	 * @param action The name of the action taken
	 * @param target The name of the item being acted on
	 * @param source The source of the action
	 */
	public createActionEvent(view: string, action: string, target: string = '', source: string = '', durationInMs?: number): ITelemetryEvent {
		const measures: ITelemetryEventMeasures = durationInMs ? { durationInMs: durationInMs } : {};
		return new TelemetryEventImpl(this.telemetryService, this.logService, EventName.Action, {
			view: view,
			action: action,
			target: target,
			source: source
		}, measures);
	}

	/**
	 * Sends a Action event. This is used to log when an action was taken, such as clicking a button.
	 * @param view The name of the page or item where this action occurred
	 * @param action The name of the action taken
	 * @param target The name of the item being acted on
	 * @param source The source of the action
	 */
	public sendActionEvent(view: string, action: string, target: string = '', source: string = '', durationInMs?: number): void {
		this.createActionEvent(view, action, target, source, durationInMs).send();
	}

	/**
	 * Creates a Metrics event that can be sent later. This is used to log measurements taken.
	 * @param metrics The metrics to send
	 */
	public createMetricsEvent(metrics: ITelemetryEventMeasures, groupName: string = ''): ITelemetryEvent {
		return new TelemetryEventImpl(this.telemetryService, this.logService, EventName.Metrics, { groupName: groupName }, metrics);
	}

	/**
	 * Sends a Metrics event. This is used to log measurements taken.
	 * @param metrics The metrics to send
	 * @param groupName The name of the group these metrics belong to
	 */
	public sendMetricsEvent(metrics: ITelemetryEventMeasures, groupName: string = ''): void {
		this.createMetricsEvent(metrics, groupName).send();
	}

	/**
	 * Creates a new Error event that can be sent later. This is used to log errors that occur.
	 * @param view The name of the page or item where the error occurred
	 * @param name The friendly name of the error
	 * @param errorCode The error code returned
	 * @param errorType The specific type of error
	 */
	public createErrorEvent(view: string, name: string, errorCode: string = '', errorType: string = ''): ITelemetryEvent {
		return new TelemetryEventImpl(this.telemetryService, this.logService, EventName.Error, {
			view: view,
			name: name,
			errorCode: errorCode,
			errorType: errorType
		});
	}

	/**
	 * Sends a Error event. This is used to log errors that occur.
	 * @param view The name of the page or item where the error occurred
	 * @param name The friendly name of the error
	 * @param errorCode The error code returned
	 * @param errorType The specific type of error
	 */
	public sendErrorEvent(view: string, name: string, errorCode: string = '', errorType: string = ''): void {
		this.createErrorEvent(view, name, errorCode, errorType).send();
	}

	/**
	 * Creates a custom telemetry event with the specified name that can be sent later. Generally the other send functions should be
	 * preferred over this - only use this if you absolutely need a custom event that can't be covered by the other methods.
	 * @param eventName The name of the event. Will be prefixed with <extension-name>/
	 * @param properties The list of properties to send along with the event
	 * @param measurements The list of measurements to send along with the event
	 */
	public createTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measurements?: ITelemetryEventMeasures): ITelemetryEvent {
		return new TelemetryEventImpl(this.telemetryService, this.logService, eventName, properties, measurements);
	}

	/**
	 * Sends a custom telemetry event with the specified name. Generally the other send functions should be
	 * preferred over this - only use this if you absolutely need a custom event that can't be covered by the other
	 * @param eventName The name of the event. Will be prefixed with <extension-name>/
	 * @param properties The list of properties to send along with the event
	 * @param measurements The list of measurements to send along with the event
	 */
	public sendTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measurements?: ITelemetryEventMeasures): void {
		this.createTelemetryEvent(eventName, properties, measurements).send();
	}
}

export class NullAdsTelemetryService implements IAdsTelemetryService {

	_serviceBrand: undefined;

	get isOptedIn(): boolean {
		return false;
	}

	setEnabled(value: boolean): void { }
	getTelemetryInfo(): Promise<ITelemetryInfo> {
		return Promise.resolve({
			sessionId: '',
			machineId: '',
			instanceId: ''
		});
	}
	createViewEvent(view: string): ITelemetryEvent { return new NullTelemetryEventImpl(); }
	sendViewEvent(view: string): void { }
	createActionEvent(view: string, action: string, target?: string, source?: string, durationInMs?: number): ITelemetryEvent { return new NullTelemetryEventImpl(); }
	sendActionEvent(view: string, action: string, target?: string, source?: string, durationInMs?: number): void { }
	createMetricsEvent(metrics: ITelemetryEventMeasures, groupName: string): ITelemetryEvent { return new NullTelemetryEventImpl(); }
	sendMetricsEvent(metrics: ITelemetryEventMeasures, groupName: string): void { }
	createErrorEvent(view: string, name: string, errorCode?: string, errorType?: string): ITelemetryEvent { return new NullTelemetryEventImpl(); }
	sendErrorEvent(view: string, name: string, errorCode?: string, errorType?: string): void { }
	createTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measurements?: ITelemetryEventMeasures): ITelemetryEvent { return new NullTelemetryEventImpl(); }
	sendTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measurements?: ITelemetryEventMeasures): void { }
}
