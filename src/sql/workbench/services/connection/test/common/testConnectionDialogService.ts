/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INewConnectionParams, IConnectionResult, IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IErrorDialogOptions } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';

export class TestConnectionDialogService implements IConnectionDialogService {
	_serviceBrand: undefined;

	public showDialog(connectionManagementService: IConnectionManagementService,
		params: INewConnectionParams, model: IConnectionProfile, connectionResult?: IConnectionResult, connectionOptions?: IConnectionCompletionOptions): Promise<void> {
		let none: void;
		return Promise.resolve(none);
	}

	public openDialogAndWait(connectionManagementService: IConnectionManagementService,
		params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult): Promise<IConnectionProfile> {
		return Promise.resolve(undefined);
	}

	public openDialogAndWaitButDontConnect(connectionManagementService: IConnectionManagementService,
		params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult): Promise<IConnectionProfile> {
		return Promise.resolve(undefined);
	}

	public callDefaultOnConnect(connection: IConnectionProfile, params: INewConnectionParams): Promise<void> {
		return Promise.resolve(undefined);
	}

	public async showErrorDialogAsync(options: IErrorDialogOptions): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}
}
