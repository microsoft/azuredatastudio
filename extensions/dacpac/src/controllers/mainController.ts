/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { DataTierApplicationWizard } from '../wizard/dataTierApplicationWizard';

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
		this.initializeDacFxWizard();
		return Promise.resolve(true);
	}

	private initializeDacFxWizard() {
		azdata.tasks.registerTask('dacFx.start', (profile: azdata.IConnectionProfile, ...args: any[]) => new DataTierApplicationWizard().start(profile, args));
	}
}
