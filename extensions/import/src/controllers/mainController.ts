/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { flatFileWizard } from '../wizard/flatFileWizard';


/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
		console.log('Main controller deactivated');
	}

	public activate(): Promise<boolean> {
		sqlops.tasks.registerTask('flatFileImport.start', e => flatFileWizard());

		return Promise.resolve(true);
	}
}
