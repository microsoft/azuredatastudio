/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';

export class TestErrorDiagnosticsService implements IErrorDiagnosticsService {
	_serviceBrand: undefined;

	registerDiagnosticsProvider(providerId: string, errorDiagnostics: azdata.diagnostics.ErrorDiagnosticsProvider): void {
	}

	unregisterDiagnosticsProvider(ProviderId: string): void {
	}

	tryHandleConnectionError(errorCode: number, errorMessage: string, providerId: string, connection: azdata.IConnectionProfile): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> {
		return Promise.resolve({ handled: false });
	}
}
