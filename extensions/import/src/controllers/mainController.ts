/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as azdata from 'azdata';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { FlatFileWizard } from '../wizard/flatFileWizard';
import { ServiceClient } from '../services/serviceClient';
import { ApiType, managerInstance } from '../services/serviceApiManager';
import { FlatFileProvider } from '../services/contracts';
import { ApiWrapper } from '../common/apiWrapper';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {
	private _outputChannel: vscode.OutputChannel;
	private _apiWrapper: ApiWrapper;

	public constructor(
		context: vscode.ExtensionContext,
		apiWrapper: ApiWrapper
	) {
		super(context);
		this._apiWrapper = apiWrapper;
		this._outputChannel = this._apiWrapper.createOutputChannel(constants.serviceName);
	}
	/**
	 */
	public deactivate(): void {
	}

	public async activate(): Promise<boolean> {
		return new Promise<boolean>(async (resolve) => {
			managerInstance.onRegisteredApi<FlatFileProvider>(ApiType.FlatFileProvider)(provider => {
				this.initializeFlatFileProvider(provider);
				resolve(true);
			});
			await new ServiceClient(this._outputChannel, this._apiWrapper).startService(this._context);
		});
	}



	private initializeFlatFileProvider(provider: FlatFileProvider) {
		this._apiWrapper.registerTask(constants.flatFileImportStartCommand, (profile: azdata.IConnectionProfile, ...args: any[]) => new FlatFileWizard(provider, this._apiWrapper).start(profile, args));
	}
}
