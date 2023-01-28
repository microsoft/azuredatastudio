/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';
import * as azdata from 'azdata';
import { ILogService } from 'vs/platform/log/common/log';

export class ErrorDiagnosticsService implements IErrorDiagnosticsService {

	_serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.diagnostics.ErrorDiagnosticsProvider; } = Object.create(null);

	constructor(
		@ILogService private readonly _logService: ILogService
	) { }

	public async tryHandleConnectionError(errorCode: number, errorMessage: string, providerId: string, connection: azdata.connection.ConnectionProfile, options: azdata.IConnectionCompletionOptions): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> {
		let result = { success: false, connectNeeded: false };
		let provider = this._providers[providerId]
		if (provider) {
			result = await provider.handleConnectionError(errorCode, errorMessage, connection, options);
		}
		return result;
	}

	/**
	 * Register a diagnostic provider object for a provider
	 * Note: only ONE diagnostic provider object can be assigned to a specific provider at a time.
	 * @param providerId the id of the provider to register.
	 * @param errorDiagnostics the actual diagnostics provider object to register under the id.
	 */
	public registerDiagnosticsProvider(providerId: string, errorDiagnostics: azdata.diagnostics.ErrorDiagnosticsProvider): void {
		if (this._providers[providerId]) {
			this._logService.error('Provider ' + providerId + ' was already registered, cannot register again.')
		}
		else {
			this._providers[providerId] = errorDiagnostics;
		}
	}

	/**
	 * Unregister a diagnostics provider object for a provider
	 *  @param providerId the id of the provider to unregister.
	 */
	public unregisterDiagnosticsProvider(providerId: string): void {
		delete this._providers[providerId];
	}
}
