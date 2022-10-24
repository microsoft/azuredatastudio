/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	export interface TelemetryConfiguration {
		/**
		 * Whether or not usage telemetry collection is allowed
		 */
		isUsageEnabled: boolean;
		/**
		 * Whether or not crash error telemetry collection is allowed
		 */
		isErrorsEnabled: boolean;
		/**
		 * Whether or not crash report collection is allowed
		 */
		isCrashEnabled: boolean;
	}

	export namespace env {
		/**
		 * Indicates what telemetry is enabled / disabled
		 * Can be observed to determine what telemetry the extension is allowed to send
		 */
		export const telemetryConfiguration: TelemetryConfiguration;

		/**
		 * An {@link Event} which fires when the collectable state of telemetry changes
		 * Returns a {@link TelemetryConfiguration} object
		 */
		export const onDidChangeTelemetryConfiguration: Event<TelemetryConfiguration | undefined>;
	}
}
