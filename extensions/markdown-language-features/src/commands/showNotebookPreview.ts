/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

import { Command } from '../commandManager';
import { MarkdownEngine } from '../markdownEngine';

export class ShowNotebookPreview implements Command {
	public readonly id = 'notebook.showPreview';

	public constructor(
		private readonly engine: MarkdownEngine
	) { }

	public async execute(document: vscode.Uri, textContent: string): Promise<string> {
		return this.engine.renderText(document, textContent);
	}
}