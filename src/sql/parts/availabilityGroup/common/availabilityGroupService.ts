/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import { IAvailabilityGroupService } from 'sql/parts/availabilityGroup/common/interfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { TPromise } from 'vs/base/common/winjs.base';

import * as sqlops from 'sqlops';

export class AvailabilityGroupService implements IAvailabilityGroupService {
	_serviceBrand: any;

	private _providers: { [handle: string]: sqlops.AvailabilityGroupServiceProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
	) {
	}

	public getAvailabilityGroups(connectionUri: string): Thenable<sqlops.AvailabilityGroupsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getAvailabilityGroups(connectionUri);
		});
	}


	private _runAction<T>(uri: string, action: (handler: sqlops.AvailabilityGroupServiceProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return TPromise.wrapError(new Error(localize('providerIdNotValidError', "Connection is required in order to interact with AvailabilityGroupService")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}

	public registerProvider(providerId: string, provider: sqlops.AvailabilityGroupServiceProvider): void {
		this._providers[providerId] = provider;
	}
}