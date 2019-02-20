'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as constants from './constants';

import AzureResourceController from './controllers/azureResourceController';
import { AppContext } from './appContext';
import ControllerBase from './controllers/controllerBase';
import { ApiWrapper } from './apiWrapper';

import { AzureResourceDatabaseServerProvider } from './azureResource/providers/registeredServer/databaseServerProvider';
import { AzureResourceDatabaseServerService } from './azureResource/providers/registeredServer/databaseServerService';

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
	const apiWrapper = new ApiWrapper();
	let appContext = new AppContext(extensionContext, apiWrapper);
	let activations: Thenable<boolean>[] = [];

	const azureResourceController = new AzureResourceController(appContext);
	controllers.push(azureResourceController);
	extensionContext.subscriptions.push(azureResourceController);
	activations.push(azureResourceController.activate());

	appContext.apiWrapper.registerCommand('cms.resource.connectsqlserver', () => {
		appContext.apiWrapper.openConnectionDialog(['MSSQL']).then( async (connection) => {
			if (connection) {
				appContext.apiWrapper.ownerUri = await sqlops.connection.getUriForConnection(connection.connectionId);
				appContext.apiWrapper.listRegisteredServers().then((result) => {
					let meme = result;
				});

			}
		});
	});



	return {
		provideResources() {
			return [
				new AzureResourceDatabaseServerProvider(new AzureResourceDatabaseServerService(), apiWrapper, extensionContext)
			];
		}
	};
}

// this method is called when your extension is deactivated
export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
