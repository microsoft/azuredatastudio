/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IConnectionResult } from 'sql/platform/connection/common/connectionManagement';
import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';

export class TestErrorDiagnosticsService implements IErrorDiagnosticsService {
	_serviceBrand: undefined;

	registerDiagnosticsProvider(providerId: string, errorDiagnostics: azdata.diagnostics.ErrorDiagnosticsProvider): void {
	}

	unregisterDiagnosticsProvider(ProviderId: string): void {
	}

	tryHandleConnectionError(connectionResult: IConnectionResult, providerId: string, connection: azdata.IConnectionProfile): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> {
		return Promise.resolve({ handled: false });
	}
}
