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
	showDialog(severity: Severity, headerTitle: string, message: string, messageDetails?: string, actions?: IAction[]): void;
}
