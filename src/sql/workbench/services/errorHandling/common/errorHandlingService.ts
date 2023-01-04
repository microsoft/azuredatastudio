/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { errorHandling } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'errorHandlerService';
export const IErrorHandlingService = createDecorator<IErrorHandlingService>(SERVICE_ID);

export interface IErrorHandlingService {
	_serviceBrand: undefined;

	/**
	 * Register an error handler for a provider
	 */
	registerErrorHandler(providerId: string, provider: azdata.ErrorHandler): void;

	/**
	 * Unregister an error handler for a provider
	 */
	unregisterErrorHandler(ProviderId: string): void;

	/**
	 * Shows error dialog with given parameters
	 * @param errorCode Error code indicating the error problem.
	 * @param errorMessage Error message that describes the problem in detail.
	 * @param connectionTypeId Identifies what provider the error comes from.
	 */
	checkErrorCode(errorCode: number, errorMessage: string, ProviderId: string): Promise<errorHandling.ErrorCodes>;
}
