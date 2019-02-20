/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { INewConnectionParams, IConnectionResult, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export const IConnectionDialogService = createDecorator<IConnectionDialogService>('connectionDialogService');
export interface IConnectionDialogService {
	_serviceBrand: any;
	/**
	 * Opens the connection dialog and returns the promise for successfully opening the dialog
	 * @param connectionManagementService
	 * @param params
	 * @param model
	 * @param connectionResult
	 */
	showDialog(connectionManagementService: IConnectionManagementService, params: INewConnectionParams, model: IConnectionProfile, connectionResult?: IConnectionResult): Thenable<void>;

	/**
	 * Opens the connection dialog and returns the promise when connection is made
	 * or dialog is closed
	 * @param connectionManagementService
	 * @param params
	 * @param model
	 * @param connectionResult
	 */
	openDialogAndWait(connectionManagementService: IConnectionManagementService, params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult, doConnect?: boolean): Thenable<IConnectionProfile>;
}

