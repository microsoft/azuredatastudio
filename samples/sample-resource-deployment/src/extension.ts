/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { SampleValueProvider } from './sampleValueProvider';

export function activate(context: vscode.ExtensionContext) {
	// Get the extension API for the resource deployment extension so we can register the value provider. Because the extension itself has a dependency
	// on the resource deployment extension we don't need to activate it here - we're guaranteed that it's already activated by the time activate is called here.
	const resourceDeploymentApi = vscode.extensions.getExtension(rd.extension.name)!.exports as rd.IExtension;
	// Always register value provider disposables so they're deregistered properly if the extension is deactivated
	context.subscriptions.push(resourceDeploymentApi.registerValueProvider(new SampleValueProvider()));
}

export function deactivate() { }
