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

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {
	private _outputChannel: vscode.OutputChannel;

	public constructor(
		context: vscode.ExtensionContext,
	) {
		super(context);
		this._outputChannel = vscode.window.createOutputChannel(constants.serviceName);
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
			await new ServiceClient(this._outputChannel).startService(this._context);
		});
	}



	private initializeFlatFileProvider(provider: FlatFileProvider) {
		azdata.tasks.registerTask(constants.flatFileImportStartCommand, (profile: azdata.IConnectionProfile, ...args: any[]) => new FlatFileWizard(provider).start(profile, args));
	}
}
