/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';
import * as azdata from 'azdata';

export class ErrorDiagnosticsService implements IErrorDiagnosticsService {

	_serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.Diagnostics; } = Object.create(null);

	constructor(
	) { }

	public async checkErrorCode(errorCode: number, errorMessage: string, providerId: string): Promise<azdata.diagnostics.ErrorDiagnosticsResponse> {
		let result = { errorAction: "" };
		let provider = this._providers[providerId]
		if (provider) {
			await provider.handleErrorCode(errorCode, errorMessage, providerId)
				.then(response => {
					if (result.errorAction !== response.errorAction) {
						result = response;
					}
				}, () => { });
		}
		return result;
	}

	/**
	 * Register a diagnostics object for a provider
	 */
	public registerDiagnostics(providerId: string, diagnostics: azdata.Diagnostics): void {
		this._providers[providerId] = diagnostics;
	}

	/**
	 * Unregister a diagnostics object for a provider
	 */
	public unregisterDiagnostics(providerId: string): void {
		delete this._providers[providerId];
	}
}
