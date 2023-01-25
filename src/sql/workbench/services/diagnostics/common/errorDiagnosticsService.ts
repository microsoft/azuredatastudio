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
	 * @param providerId the id of the provider to be registered.
	 * @param errorDiagnostics the actual diagnostics provider object to be registered under the id.
	 */
	registerDiagnosticsProvider(providerId: string, errorDiagnostics: azdata.diagnostics.ErrorDiagnosticsProvider): void;

	/**
	 * Unregister a Diagnostics object for a provider
	 * @param providerId the id of the provider to be unregistered.
	 */
	unregisterDiagnosticsProvider(ProviderId: string): void;

	/**
	 * Checks connection error with given parameters
	 * @param errorCode Error code indicating the error problem.
	 * @param errorMessage Error message that describes the problem in detail.
	 * @param providerId Identifies what provider the error comes from.
	 * @param connection Connection profile that is utilized for connection
	 * @param options the connection complete options provided with the profile
	 */
	tryHandleConnectionError(errorCode: number, errorMessage: string, providerId: string, connection: azdata.connection.ConnectionProfile, options: azdata.IConnectionCompletionOptions): Promise<azdata.diagnostics.ConnectionDiagnosticsResult>;
}
