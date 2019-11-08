/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class TestErrorMessageService implements IErrorMessageService {
	_serviceBrand: undefined;
	showDialog(severity: Severity, headerTitle: string, message: string): void {
	}
}
