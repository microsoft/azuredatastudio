/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';


import * as constants from './constants';
import * as utils from './utils';

import { ApiWrapper } from './apiWrapper';
import { AppContext } from './appContext';
import { DataSourceWizardService } from './services/contracts';
import { managerInstance, ApiType } from './services/serviceApiManager';
import { OpenVirtualizeDataWizardCommand, OpenVirtualizeDataWizardTask, OpenMssqlHdfsTableFromFileWizardCommand } from './wizards/wizardCommands';
import { ServiceClient } from './services/serviceClient';

export function activate(extensionContext: vscode.ExtensionContext): void {
	let apiWrapper = new ApiWrapper();
	let appContext = new AppContext(extensionContext, apiWrapper);

	let wizard = managerInstance.onRegisteredApi<DataSourceWizardService>(ApiType.DataSourceWizard);
	wizard((wizardService: DataSourceWizardService) => {
		apiWrapper.setCommandContext(constants.CommandContext.WizardServiceEnabled, true);

		extensionContext.subscriptions.push(new OpenVirtualizeDataWizardCommand(appContext, wizardService));
		apiWrapper.registerTaskHandler(constants.virtualizeDataTask, (profile: azdata.IConnectionProfile) => {
			new OpenVirtualizeDataWizardTask(appContext, wizardService).execute(profile);
		});

		extensionContext.subscriptions.push(new OpenMssqlHdfsTableFromFileWizardCommand(appContext, wizardService));
	});

	const outputChannel = apiWrapper.createOutputChannel(constants.serviceName);
	let serviceClient = new ServiceClient(apiWrapper, outputChannel);
	serviceClient.startService(extensionContext).then(success => undefined, err => {
		apiWrapper.showErrorMessage(utils.getErrorMessage(err));
	});
}
