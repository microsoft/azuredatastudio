/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SampleController } from './sampleController';
import { SampleSerializer } from './sampleSerializer';

export function activate(context: vscode.ExtensionContext) {
	// Create and register the serializer and controller with Azure Data Studio
	context.subscriptions.push(
		vscode.workspace.registerNotebookSerializer('my-notebook', new SampleSerializer())
	);
	context.subscriptions.push(new SampleController(context));
}

export function deactivate() { }
