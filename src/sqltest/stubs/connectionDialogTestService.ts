/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
	IConnectionDialogService, IConnectionManagementService, INewConnectionParams, IConnectionResult
} from 'sql/platform/connection/common/connectionManagement';
import { TPromise } from 'vs/base/common/winjs.base';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export class ConnectionDialogTestService implements IConnectionDialogService {
	_serviceBrand: any;

	public showDialog(connectionManagementService: IConnectionManagementService,
		params: INewConnectionParams, model: IConnectionProfile, connectionResult?: IConnectionResult): TPromise<void> {
		let none: void;
		return TPromise.as(none);
	}

	public openDialogAndWait(connectionManagementService: IConnectionManagementService,
		params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult): TPromise<IConnectionProfile> {
		return TPromise.as(undefined);
	}
}