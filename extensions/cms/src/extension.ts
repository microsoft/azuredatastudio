'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as path from 'path';
import * as os from 'os';

import AzureResourceController from './controllers/cmsResourceController';
import { AppContext } from './appContext';
import ControllerBase from './controllers/controllerBase';
import { ApiWrapper } from './apiWrapper';

import { CmsResourceProvider } from './cmsResource/providers/cmsResourceProvider';

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

	// appContext.apiWrapper.registerCommand('cms.resource.connectsqlserver', () => {
	// 	let ownerUri = appContext.apiWrapper.ownerUri;


	// });

	return {
		provideResources() {
			return [
				new CmsResourceProvider(appContext.apiWrapper, extensionContext)
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
