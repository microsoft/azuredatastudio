/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'errorDiagnosticsService';
export const IErrorDiagnosticsService = createDecorator<IErrorDiagnosticsService>(SERVICE_ID);

export interface IErrorDiagnosticsService {
	_serviceBrand: undefined;

	/**
	 * Register a Diagnostics object for a provider
	 */
	registerDiagnosticsProvider(providerId: string, diagnostics: azdata.diagnostics.ErrorDiagnostics): void;

	/**
	 * Unregister a Diagnostics object for a provider
	 */
	unregisterDiagnosticsProvider(ProviderId: string): void;

	/**
	 * Checks connection error with given parameters
	 * @param errorCode Error code indicating the error problem.
	 * @param errorMessage Error message that describes the problem in detail.
	 * @param providerId Identifies what provider the error comes from.
	 * @param connection Connection profile that is utilized for connection
	 */
	checkConnectionError(errorCode: number, errorMessage: string, providerId: string, connection: azdata.connection.ConnectionProfile, options: azdata.IConnectionCompletionOptions): Promise<boolean>;
}
