/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';

export const SERVICE_ID = 'dacFxService';
export const IDacFxService= createDecorator<IDacFxService>(SERVICE_ID);

export interface IDacFxService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.DacFxServicesProvider): void;
	exportBacpac(connectionString: string): void;
}

export class DacFxService implements IDacFxService {
	_serviceBrand: any;
	private _providers: { [handle: string]: sqlops.DacFxServicesProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	registerProvider(providerId: string, provider: sqlops.DacFxServicesProvider): void {
		this._providers[providerId] = provider;
	}

	exportBacpac(connectionString: string): Thenable<sqlops.DacFxExportResult> {
		return this._runAction(connectionString, (runner) => {
			return runner.exportBacpac(connectionString);
		});
	}

	private _runAction<T>(uri: string, action: (handler: sqlops.DacFxServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return TPromise.wrapError(new Error(localize('providerIdNotValidError', "Connection is required in order to interact with DacFxService")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}
}