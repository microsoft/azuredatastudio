/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NotificationType, ServerOptions } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from '../telemetry';
import { Runtime } from '../platform';

// ------------------------------- < Telemetry Sent Event > ------------------------------------

/**
 * Event sent when the language service send a telemetry event
 */
export namespace TelemetryNotification {
	export const type = new NotificationType<TelemetryParams, void>('telemetry/sqlevent');
}

/**
 * Update event parameters
 */
export class TelemetryParams {
	public params: {
		eventName: string;
		properties: ITelemetryEventProperties;
		measures: ITelemetryEventMeasures;
	};
}

// ------------------------------- </ Telemetry Sent Event > ----------------------------------

// ------------------------------- < Status Event > ------------------------------------

/**
 * Event sent when the language service send a status change event
 */
export namespace StatusChangedNotification {
	export const type = new NotificationType<StatusChangeParams, void>('textDocument/statusChanged');
}

/**
 * Update event parameters
 */
export class StatusChangeParams {
	/**
	 * URI identifying the text document
	 */
	public ownerUri: string;

	/**
	 * The new status of the document
	 */
	public status: string;
}

// ------------------------------- </ Status Sent Event > ----------------------------------

export interface ILanguageClientHelper {
	createServerOptions(servicePath: string, runtimeId?: Runtime): ServerOptions;
}