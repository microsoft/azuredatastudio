/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as path from 'path';
import * as fs from 'fs';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	public constructor(
		context: vscode.ExtensionContext,
		apiWrapper: ApiWrapper
	) {
		super(context);
	}

	public deactivate(): void {
	}

	public async activate(): Promise<boolean> {
		// ...

		return new Promise<boolean>(async (resolve) => {
			vscode.commands.registerCommand('db-diagram.new', async () => {

				//Dummy Data
				/*const serverName = 'My Server';
				const dbName = 'My Database';
				const dbInformation = 'This is a database about a company. There is 1 significant cluster';
				const tables = ['Employee', 'Department', 'Manager'];*/

				// Create and show a new webview
				const panel = vscode.window.createWebviewPanel(
					'dbDiagram', // Identifies the type of the webview. Used internally
					'DB Diagram', // Title of the panel displayed to the user
					vscode.ViewColumn.One, // Editor column to show the new webview panel in.
					{} // Webview options. More on these later.
				);
				const onDiskPath = vscode.Uri.file(
					path.join('..', '..', 'src', 'ui-resources', 'index.html')
				);
				const htmlTemplate = panel.webview.asWebviewUri(onDiskPath);
				panel.webview.html = await fs.promises.readFile(htmlTemplate.fsPath, 'utf-8');

			});

			resolve(true);
		});


	}

}
