/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { IErrorMessageService } from 'sql/platform/connection/common/connectionManagement';
import Severity from 'vs/base/common/severity';

export class ErrorMessageServiceStub implements IErrorMessageService {
	_serviceBrand: any;
	showDialog(severity: Severity, headerTitle: string, message: string): void {
	}
}