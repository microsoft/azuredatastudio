/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// The module 'sqlops' contains the SQL Operations Studio extensibility API
// This is a complementary set of APIs that add SQL / Data-specific functionality to the app
// Import the module and reference it with the alias sqlops in your code below

import ControllerBase from './controllers/controllerBase';
import MainController from './controllers/mainController';

let controllers: ControllerBase[] = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activations: Promise<boolean>[] = [];

	// Start the main controller
	let mainController = new MainController(context);
	controllers.push(mainController);
	context.subscriptions.push(mainController);
	activations.push(mainController.activate());

	return Promise.all(activations)
		.then((results: boolean[]) => {
			for (let result of results) {
				if (!result) {
					return false;
				}
			}
			return true;
		});


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "flat-file-importer" is now active!');

	// // The command has been defined in the package.json file
	// // Now provide the implementation of the command with  registerCommand
	// // The commandId parameter must match the command field in package.json
	// context.subscriptions.push(vscode.commands.registerCommand('extension.sayHello', () => {
	//     // The code you place here will be executed every time your command is executed
	//
	//     // Display a message box to the user
	//     vscode.window.showInformationMessage('Hello World!');
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('flatFileImport.start', () => {
	// 	// The code you place here will be executed every time your command is executed
	//
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('This button is working');
	// }));


	// context.subscriptions.push(vscode.commands.registerCommand('extension.showCurrentConnection', () => {
	//     // The code you place here will be executed every time your command is executed
	//
	//     // Display a message box to the user
	//     sqlops.connection.getCurrentConnection().then(connection => {
	//         let connectionId = connection ? connection.connectionId : 'No connection found!';
	//         vscode.window.showInformationMessage(connectionId);
	//     }, error => {
	//          console.info(error);
	//     });
	// }));
}

// this method is called when your extension is deactivated
export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
