/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { INewConnectionParams, IConnectionResult, IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IErrorDialogOptions } from 'sql/workbench/api/common/sqlExtHostTypes';

export const IConnectionDialogService = createDecorator<IConnectionDialogService>('connectionDialogService');
export interface IConnectionDialogService {
	_serviceBrand: undefined;
	/**
	 * Opens the connection dialog and returns the promise for successfully opening the dialog
	 */
	showDialog(connectionManagementService: IConnectionManagementService, params: INewConnectionParams, model: Partial<IConnectionProfile>, connectionResult?: IConnectionResult, connectionOptions?: IConnectionCompletionOptions): Promise<void>;

	/**
	 * Opens the connection dialog and returns the promise when connection is made
	 * or dialog is closed
	 */
	openDialogAndWait(connectionManagementService: IConnectionManagementService, params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult, doConnect?: boolean): Promise<IConnectionProfile>;

	/**
	 * Calls the default connect function (used by password reset dialog)
	 */
	callDefaultOnConnect(connection: IConnectionProfile, params: INewConnectionParams): Promise<void>;

	/**
	 * Opens the error dialog with customization options provided.
	 * @param profile The connection profile associated with error dialog.
	 * @returns Id of action button clicked by user, e.g. ok, cancel
	 */
	openCustomErrorDialog(options: IErrorDialogOptions): Promise<string | undefined>;
}
