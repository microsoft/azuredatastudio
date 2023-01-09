/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDiagnosticsService } from 'sql/workbench/services/diagnostics/common/diagnosticsService';
import { diagnostics } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as azdata from 'azdata';

export class DiagnosticsService implements IDiagnosticsService {

	_serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.Diagnostics; } = Object.create(null);

	constructor(
	) { }

	public async checkErrorCode(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<diagnostics.ErrorCodes> {
		let result = diagnostics.ErrorCodes.noErrorOrUnsupported
		const promises = [];
		if (this._providers) {
			for (const key in this._providers) {
				const provider = this._providers[key];
				promises.push(provider.handleErrorCode(errorCode, errorMessage, connectionTypeId)
					.then(response => {
						if (result === diagnostics.ErrorCodes.noErrorOrUnsupported) {
							result = response;
						}
					}, () => { }));
			}
		}

		await Promise.all(promises);
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
