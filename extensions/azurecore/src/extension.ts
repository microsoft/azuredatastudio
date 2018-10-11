'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as constants from './constants';

import MainController from './controllers/mainController';
import { AppContext } from './appContext';
import ControllerBase from './controllers/controllerBase';
import { ApiWrapper } from './apiWrapper';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';

let controllers: ControllerBase[] = [];


// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
export function getAppDataPath() {
	var platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

export function getDefaultLogLocation() {
	return path.join(getAppDataPath(), 'azuredatastudio');
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(extensionContext: vscode.ExtensionContext) {
	let appContext = new AppContext(extensionContext, new ApiWrapper());
	let activations: Thenable<boolean>[] = [];

	// Create the folder for storing the token caches
	let storagePath = path.join(getDefaultLogLocation(), constants.extensionName);
	try {
		if (!fs.existsSync(storagePath)) {
			fs.mkdirSync(storagePath);
			console.log('Initialized Azure account extension storage.');
		}
	} catch (e) {
		console.error(`Initialization of Azure account extension storage failed: ${e}`);
		console.error('Azure accounts will not be available');
		return;
	}

	// Create the provider service and activate
	const accountProviderService = new AzureAccountProviderService(extensionContext, storagePath);
	extensionContext.subscriptions.push(accountProviderService);
	accountProviderService.activate();

	// Start the main controller
	let mainController = new MainController(appContext);
	controllers.push(mainController);
	extensionContext.subscriptions.push(mainController);
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
}

// this method is called when your extension is deactivated
export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
