/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { INewConnectionParams, IConnectionResult } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnection } from 'sql/platform/connection/common/connectionService';

export const IConnectionDialogService = createDecorator<IConnectionDialogService>('connectionDialogService');
export interface IConnectionDialogService {
	_serviceBrand: undefined;
	/**
	 * Opens the connection dialog and returns the promise for successfully opening the dialog
	 */
	showDialog(params: INewConnectionParams, model: IConnectionProfile, connectionResult?: IConnectionResult): Promise<void>;

	/**
	 * Opens the connection dialog and returns the promise when connection is made
	 * or dialog is closed
	 */
	openDialogAndWait(params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult, doConnect?: boolean): Promise<IConnection>;
}
