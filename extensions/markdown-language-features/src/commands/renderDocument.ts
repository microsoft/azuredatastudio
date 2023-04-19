/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from '../commandManager';
import { MarkdownEngine } from '../markdownEngine';
import { SkinnyTextDocument } from '../workspaceContents';

export class RenderDocument implements Command {
	public readonly id = 'markdown.api.render';

	public constructor(
		private readonly engine: MarkdownEngine
	) { }

	public async execute(document: SkinnyTextDocument | string): Promise<string> {
		return (await (this.engine.render(document))).html;
	}
}
