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

	public async checkErrorCode(errorCode: number, errorMessage: string, providerId: string): Promise<boolean> {
		let result = false;
		let provider = this._providers[providerId]
		if (provider) {
			result = await provider.handleErrorCode(errorCode, errorMessage)
		}
		return result;
	}

	/**
	 * Register a diagnostics object for a provider
	 */
	public registerDiagnostics(providerId: string, diagnostics: azdata.diagnostics.ErrorDiagnostics): void {
		this._providers[providerId] = diagnostics;
	}

	/**
	 * Unregister a diagnostics object for a provider
	 */
	public unregisterDiagnostics(providerId: string): void {
		delete this._providers[providerId];
	}
}
