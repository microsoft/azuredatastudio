/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MarkdownEngine } from '../markdownEngine';
import { MarkdownContributionProvider, MarkdownContributions } from '../markdownExtensions';
import { githubSlugifier } from '../slugify';
import { Disposable } from '../util/dispose';

const emptyContributions = new class extends Disposable implements MarkdownContributionProvider {
	readonly extensionPath = '';
	readonly contributions = MarkdownContributions.Empty;
	readonly onContributionsChanged = this._register(new vscode.EventEmitter<this>()).event;
};

export function createNewMarkdownEngine(): MarkdownEngine {
	return new MarkdownEngine(emptyContributions, githubSlugifier);
}
