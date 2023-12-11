/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { IAction } from 'vs/base/common/actions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';

export const IErrorMessageService = createDecorator<IErrorMessageService>('errorMessageService');
export interface IErrorMessageService {
	_serviceBrand: undefined;
	/**
	 * Shows error dialog with given parameters
	 * @param severity Severity of the error
	 * @param headerTitle Title to show on Error modal dialog
	 * @param message Message containng error message
	 * @param messageDetails Message details containing stacktrace along with error message
	 * @param telemetryView Telemetry View to be used for dispatching telemetry events.
	 * @param actions Custom actions to display on the error message dialog
	 * @param instructionText Special instructions to display to user when displaying error message
	 * @param readMoreLink External link to read more about the instructions.
	 */
	showDialog(severity: Severity, headerTitle: string, message: string, messageDetails?: string, telemetryView?: TelemetryView, actions?: IAction[], instructionText?: string, readMoreLink?: string): void;
}
