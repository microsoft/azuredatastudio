/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IErrorHandlingService } from 'sql/workbench/services/errorHandling/common/errorHandlingService';
import { diagnostics } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as azdata from 'azdata';

export class ErrorHandlingService implements IErrorHandlingService {

	_serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.ErrorHandler; } = Object.create(null);

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
	 * Register an errorHandler
	 */
	public registerErrorHandler(providerId: string, provider: azdata.ErrorHandler): void {
		this._providers[providerId] = provider;
	}

	/**
	 * Unregister an errorHandler
	 */
	public unregisterErrorHandler(providerId: string): void {
		delete this._providers[providerId];
	}
}
