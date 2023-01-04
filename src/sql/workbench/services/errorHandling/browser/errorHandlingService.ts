/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IErrorHandlingService } from 'sql/workbench/services/errorHandling/common/errorHandlingService';
import { errorHandling } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as azdata from 'azdata';

export class ErrorHandlingService implements IErrorHandlingService {

	_serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.ErrorHandler; } = Object.create(null);

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) { }

	public async checkErrorCode(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<errorHandling.ErrorCodes> {
		const promises = [];
		if (this._providers) {
			for (const key in this._providers) {
				const provider = this._providers[key];
				// promises.push(provider.handleFirewallRule(errorCode, errorMessage, connectionTypeId)
				// 	.then(response => {
				// 		if (response.result) {
				// 			handleFirewallRuleResult = { canHandleFirewallRule: response.result, ipAddress: response.ipAddress, resourceProviderId: key };
				// 		}
				// 	}, () => { /* Swallow failures at getting accounts, we'll just hide that provider */
				// 	}));
			}
		}

		await Promise.all(promises);
		return errorHandling.ErrorCodes.noErrorOrUnsupported
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
