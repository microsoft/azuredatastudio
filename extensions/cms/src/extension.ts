'use strict';

import * as vscode from 'vscode';
import CmsResourceController from './controllers/cmsResourceController';
import { AppContext } from './appContext';
import ControllerBase from './controllers/controllerBase';
import { ApiWrapper } from './apiWrapper';

let controllers: ControllerBase[] = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(extensionContext: vscode.ExtensionContext) {
	const apiWrapper = new ApiWrapper();
	let appContext = new AppContext(extensionContext, apiWrapper);
	let activations: Thenable<boolean>[] = [];

	const cmsResourceController = new CmsResourceController(appContext);
	controllers.push(cmsResourceController);
	extensionContext.subscriptions.push(cmsResourceController);
	activations.push(cmsResourceController.activate());
}

// this method is called when your extension is deactivated
export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
