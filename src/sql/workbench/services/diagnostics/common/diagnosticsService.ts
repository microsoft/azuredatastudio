/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { diagnostics } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'diagnosticsService';
export const IDiagnosticsService = createDecorator<IDiagnosticsService>(SERVICE_ID);

export interface IDiagnosticsService {
	_serviceBrand: undefined;

	/**
	 * Register a Diagnostics object for a provider
	 */
	registerDiagnostics(providerId: string, diagnostics: azdata.Diagnostics): void;

	/**
	 * Unregister a Diagnostics object for a provider
	 */
	unregisterDiagnostics(ProviderId: string): void;

	/**
	 * Shows error dialog with given parameters
	 * @param errorCode Error code indicating the error problem.
	 * @param errorMessage Error message that describes the problem in detail.
	 * @param connectionTypeId Identifies what provider the error comes from.
	 */
	checkErrorCode(errorCode: number, errorMessage: string, ProviderId: string): Promise<diagnostics.ErrorCodes>;
}
