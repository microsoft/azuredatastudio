/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';
import * as azdata from 'azdata';

export class ErrorDiagnosticsService implements IErrorDiagnosticsService {

	_serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.diagnostics.ErrorDiagnostics; } = Object.create(null);

	constructor(
	) { }

	public async checkConnectionError(errorCode: number, errorMessage: string, providerId: string, connection: azdata.connection.ConnectionProfile, options: azdata.IConnectionCompletionOptions): Promise<boolean> {
		let result = false;
		let provider = this._providers[providerId]
		if (provider) {
			result = await provider.handleConnectionError(errorCode, errorMessage, connection, options);
		}
		return result;
	}

	/**
	 * Register a diagnostics object for a provider
	 * @param providerId the id of the provider to register.
	 * @param diagnostics the actual diagnostics provider object to register under the id.
	 */
	public registerDiagnosticsProvider(providerId: string, diagnostics: azdata.diagnostics.ErrorDiagnostics): void {
		this._providers[providerId] = diagnostics;
	}

	/**
	 * Unregister a diagnostics object for a provider
	 *  @param providerId the id of the provider to unregister.
	 */
	public unregisterDiagnosticsProvider(providerId: string): void {
		delete this._providers[providerId];
	}
}
