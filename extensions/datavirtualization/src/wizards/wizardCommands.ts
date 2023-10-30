/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ICommandViewContext, Command, ICommandObjectExplorerContext, ICommandUnknownContext } from '../command';
import { VirtualizeDataWizard } from './virtualizeData/virtualizeDataWizard';
import { DataSourceWizardService } from '../services/contracts';
import { AppContext } from '../appContext';
import { getErrorMessage } from '../utils';
import * as constants from '../constants';
import { TableFromFileWizard } from './tableFromFile/tableFromFileWizard';
import { getNodeFromMssqlProvider } from '../hdfsCommands';
import { HdfsFileSourceNode } from '../hdfsProvider';

export class OpenVirtualizeDataWizardCommand extends Command {
	private readonly dataWizardTask: OpenVirtualizeDataWizardTask;

	constructor(appContext: AppContext, wizardService: DataSourceWizardService) {
		super(constants.virtualizeDataCommand, appContext);
		this.dataWizardTask = new OpenVirtualizeDataWizardTask(appContext, wizardService);
	}

	protected async preExecute(context: ICommandUnknownContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandUnknownContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		let profile: azdata.IConnectionProfile = undefined;
		if (context && context.type === constants.ObjectExplorerService && context.explorerContext) {
			profile = context.explorerContext.connectionProfile;
		}
		this.dataWizardTask.execute(profile, args);
	}
}

export class OpenVirtualizeDataWizardTask {
	constructor(private appContext: AppContext, private wizardService: DataSourceWizardService) {
	}

	async execute(profile: azdata.IConnectionProfile, ...args: any[]): Promise<void> {
		try {
			let connection: azdata.connection.ConnectionProfile;
			if (profile) {
				connection = convertIConnectionProfile(profile);
			} else {
				connection = await azdata.connection.getCurrentConnection();
				if (!connection) {
					this.appContext.apiWrapper.showErrorMessage(localize('noConnection', 'Data Virtualization requires a connection to be selected.'));
					return;
				}
			}
			let wizard = new VirtualizeDataWizard(connection, this.wizardService, this.appContext);
			await wizard.openWizard();
		} catch (error) {
			this.appContext.apiWrapper.showErrorMessage(getErrorMessage(error));
		}
	}
}

export class OpenMssqlHdfsTableFromFileWizardCommand extends Command {
	constructor(appContext: AppContext, private wizardService: DataSourceWizardService) {
		super(constants.mssqlHdfsTableFromFileCommand, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let connection: azdata.connection.ConnectionProfile;
			if (context && context.type === constants.ObjectExplorerService && context.explorerContext) {
				connection = convertIConnectionProfile(context.explorerContext.connectionProfile);
			}

			if (!connection) {
				connection = await azdata.connection.getCurrentConnection();
				if (!connection) {
					this.appContext.apiWrapper.showErrorMessage(localize('noConnection', 'Data Virtualization requires a connection to be selected.'));
					return;
				}
			}

			let fileNode = await getNodeFromMssqlProvider<HdfsFileSourceNode>(context, this.appContext);
			let wizard = new TableFromFileWizard(connection, this.appContext, this.wizardService);
			await wizard.start(fileNode);
		} catch (error) {
			this.appContext.apiWrapper.showErrorMessage(getErrorMessage(error));
		}
	}
}

function convertIConnectionProfile(profile: azdata.IConnectionProfile): azdata.connection.ConnectionProfile {
	const connection = azdata.connection.ConnectionProfile.createFrom(profile.options);
	connection.providerId = profile.providerName;
	connection.databaseName = profile.databaseName;
	return connection;
}
