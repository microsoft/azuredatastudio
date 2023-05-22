/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IAction } from 'vs/base/common/actions';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';

export const ITroubleshooterMessageService = createDecorator<ITroubleshooterMessageService>('troubleshooterMessageService');
export interface ITroubleshooterMessageService {
	_serviceBrand: undefined;
	/**
	 * Shows error dialog with given parameters
	 * @param headerTitle Title to show on Troubleshooter modal dialog
	 * @param message Message containing error message
	 * @param telemetryView Telemetry View to be used for dispatching telemetry events.
	 * @param actions Custom actions to display on the error message dialog
	 */
	showDialog(headerTitle: string, message: string, telemetryView?: TelemetryView, actions?: IAction[]): void;
}
