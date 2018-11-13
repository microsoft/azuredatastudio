/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as constants from '../constants';
import * as sqlops from 'sqlops';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { FlatFileWizard } from '../wizard/flatFileWizard';
import { ServiceClient } from '../services/serviceClient';
import { ApiType, managerInstance } from '../services/serviceApiManager';
import { FlatFileProvider } from '../services/contracts';
import { ExportWizard } from '../wizard/exportBacpacWizard';
import { ImportBacpacWizard } from '../wizard/importBacpacWizard';
import { ExtractWizard } from '../wizard/extractDacpacWizard';
import { DeployWizard } from '../wizard/deployDacpacWizard';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	public constructor(context: vscode.ExtensionContext) {
		super(context);
	}
	/**
	 */
	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		const outputChannel = vscode.window.createOutputChannel(constants.serviceName);
		new ServiceClient(outputChannel).startService(this._context);

		managerInstance.onRegisteredApi<FlatFileProvider>(ApiType.FlatFileProvider)(provider => {
			this.initializeFlatFileProvider(provider);
		});

		this.initializeDacFxExport();
		this.initializeDacFxImport();
		this.initializeDacFxExtract();
		this.initializeDacFxDeploy();
		return Promise.resolve(true);
	}

	private initializeFlatFileProvider(provider: FlatFileProvider) {
		sqlops.tasks.registerTask('flatFileImport.start', (profile: sqlops.IConnectionProfile, ...args: any[]) => new FlatFileWizard(provider).start(profile, args));
	}

	private initializeDacFxExport() {
		sqlops.tasks.registerTask('dacFxExport.start', (profile: sqlops.IConnectionProfile, ...args: any[]) => new ExportWizard().start(profile, args));
	}

	private initializeDacFxImport() {
		sqlops.tasks.registerTask('dacFxImport.start', (profile: sqlops.IConnectionProfile, ...args: any[]) => new ImportBacpacWizard().start(profile, args));
	}

	private initializeDacFxExtract() {
		sqlops.tasks.registerTask('dacFxExtract.start', (profile: sqlops.IConnectionProfile, ...args: any[]) => new ExtractWizard().start(profile, args));
	}

	private initializeDacFxDeploy() {
		sqlops.tasks.registerTask('dacFxDeploy.start', (profile: sqlops.IConnectionProfile, ...args: any[]) => new DeployWizard().start(profile, args));
	}
}
