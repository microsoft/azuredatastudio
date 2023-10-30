/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Viewlet } from './viewlet';
import { Code } from './code';
import path = require('path');
import fs = require('fs');
import { ncp } from 'ncp';
import { promisify } from 'util';

const SEARCH_BOX = 'div.extensions-viewlet[id="workbench.view.extensions"] .monaco-editor textarea';
const REFRESH_BUTTON = 'div.part.sidebar.left[id="workbench.parts.sidebar"] .codicon.codicon-extensions-refresh';

export class Extensions extends Viewlet {

	constructor(code: Code) {
		super(code);
	}

	async openExtensionsViewlet(): Promise<any> {
		if (process.platform === 'darwin') {
			await this.code.dispatchKeybinding('cmd+shift+x');
		} else {
			await this.code.dispatchKeybinding('ctrl+shift+x');
		}

		await this.code.waitForActiveElement(SEARCH_BOX);
	}

	async searchForExtension(id: string): Promise<any> {
		await this.code.waitAndClick(SEARCH_BOX);
		await this.code.waitForActiveElement(SEARCH_BOX);
		await this.code.waitForTypeInEditor(SEARCH_BOX, `@id:${id}`);
		await this.code.waitForTextContent(`div.part.sidebar div.composite.title h2`, 'Extensions: Marketplace');

		let retrials = 1;
		while (retrials++ < 10) {
			try {
				return await this.code.waitForElement(`div.extensions-viewlet[id="workbench.view.extensions"] .monaco-list-row[data-extension-id="${id}"]`, undefined, 100);
			} catch (error) {
				this.code.logger.log(`Extension '${id}' is not found. Retrying count: ${retrials}`);
				await this.code.waitAndClick(REFRESH_BUTTON);
			}
		}
		throw new Error(`Extension ${id} is not found`);
	}

	async openExtension(id: string): Promise<any> {
		await this.searchForExtension(id);
		await this.code.waitAndClick(`div.extensions-viewlet[id="workbench.view.extensions"] .monaco-list-row[data-extension-id="${id}"]`);
	}

	async closeExtension(title: string): Promise<any> {
		await this.code.waitAndClick(`.tabs-container div.tab[title="Extension: ${title}"] div.tab-actions a.action-label.codicon.codicon-close`);
	}

	async installExtension(id: string, waitUntilEnabled: boolean): Promise<void> {
		await this.searchForExtension(id);
		await this.code.waitAndClick(`div.extensions-viewlet[id="workbench.view.extensions"] .monaco-list-row[data-extension-id="${id}"] .extension-list-item .monaco-action-bar .action-item:not(.disabled) .extension-action.install`);
		await this.code.waitForElement(`.extension-editor .monaco-action-bar .action-item:not(.disabled) .extension-action.uninstall`);
		if (waitUntilEnabled) {
			await this.code.waitForElement(`.extension-editor .monaco-action-bar .action-item:not(.disabled)[title="Disable this extension"]`);
		}
	}
}

export async function copyExtension(repoPath: string, extensionsPath: string, extId: string): Promise<void> {
	const dest = path.join(extensionsPath, extId);
	if (!fs.existsSync(dest)) {
		const orig = path.join(repoPath, 'extensions', extId);

		return promisify(ncp)(orig, dest);
	}
}
