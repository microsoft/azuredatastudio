/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';

export class TestErrorDiagnosticsService implements IErrorDiagnosticsService {
	_serviceBrand: undefined;

	registerDiagnostics(providerId: string, diagnostics: azdata.diagnostics.ErrorDiagnostics): void {
	}

	unregisterDiagnostics(ProviderId: string): void {
	}

	checkErrorCode(errorCode: number, errorMessage: string, providerId: string, additionalObjects?: any): Promise<boolean> {
		return Promise.resolve(false);
	}
}
