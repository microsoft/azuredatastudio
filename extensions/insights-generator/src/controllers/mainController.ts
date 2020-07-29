/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as azdata from 'azdata';
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

				// ...
				console.log('new diagram');



			});

			resolve(true);
		});
	}
}
