/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { IAction } from 'vs/base/common/actions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IErrorMessageService = createDecorator<IErrorMessageService>('errorMessageService');
export interface IErrorMessageService {
	_serviceBrand: undefined;
	/**
	 * Shows error dialog with given parameters
	 * @param severity Severity of the error
	 * @param headerTitle Title to show on Error modal dialog
	 * @param message Message containng error message
	 * @param messageDetails Message details containing stacktrace along with error message
	 * @param actions Custom actions to display on the error message dialog
	 * @param instructionText Spcial instructions to display to user when displaying error message
	 * @param readMoreLink External link to read more about the instructions.
	 */
	showDialog(severity: Severity, headerTitle: string, message: string, messageDetails?: string, actions?: IAction[], instructionText?: string, readMoreLink?: string): void;
}
