/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as vscode from 'vscode';

import { Command } from '../commandManager';

export class OnPreviewStyleLoadErrorCommand implements Command {
	public readonly id = '_markdown.onPreviewStyleLoadError';

	public execute(resources: string[]) {
		vscode.window.showWarningMessage(localize('onPreviewStyleLoadError', "Could not load 'markdown.styles': {0}", resources.join(', ')));
	}
}
