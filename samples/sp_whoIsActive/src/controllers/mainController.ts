/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as Utils from '../utils';
import ControllerBase from './controllerBase';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as openurl from 'openurl';


/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	public apiWrapper;
	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
		Utils.logDebug('Main controller deactivated');
	}

	public activate(): Promise<boolean> {
		azdata.tasks.registerTask('sp_whoisactive.install', e => this.openurl('http://whoisactive.com/downloads/'));
		azdata.tasks.registerTask('sp_whoisactive.documentation', e => this.openurl('http://whoisactive.com/docs/'));
		azdata.tasks.registerTask('sp_whoisactive.findBlockLeaders', e => this.onExecute(e, 'findBlockLeaders.sql'));
		azdata.tasks.registerTask('sp_whoisactive.getPlans', e => this.onExecute(e, 'getPlans.sql'));

		return Promise.resolve(true);
	}

	private openurl(link: string): void {
		openurl.open(link);
	}

	private onExecute(connection: azdata.IConnectionProfile, fileName: string): void {
		let sqlContent = fs.readFileSync(path.join(__dirname, '..', 'sql', fileName)).toString();
		vscode.workspace.openTextDocument({language: 'sql', content: sqlContent}).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Active, false).then(() => {
				let filePath = doc.uri.toString();
				azdata.queryeditor.connect(filePath, connection.id).then(() => azdata.queryeditor.runQuery(filePath));
			});
		});
	}
}
