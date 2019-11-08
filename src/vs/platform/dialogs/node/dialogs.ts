/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryData } from 'vs/platform/telemetry/common/telemetry';

export interface INativeOpenDialogOptions {
	forceNewWindow?: boolean;

	defaultPath?: string;

	telemetryEventName?: string;
	telemetryExtraData?: ITelemetryData;
}
