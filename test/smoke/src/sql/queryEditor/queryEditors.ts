/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Editors } from '../../areas/editor/editors';
import { QuickOpen } from '../../areas/quickopen/quickopen';
import { Code } from '../../vscode/code';
import * as path from 'path';

export class QueryEditors extends Editors {

	constructor(
		private vsCode: Code,
		private quickopen: QuickOpen
	) {
		super(vsCode);
	}

	/**
	 * Opens the specified file - this correctly handles SQL files which are opened in a Query Editor window
	 * @param fileName The full path of the file to open.
	 */
	async openFile(fileName: string): Promise<void> {
		await this.quickopen.openQuickOpen(fileName);

		const fileBaseName = path.basename(fileName);
		await this.quickopen.waitForQuickOpenElements(names => names[0] === fileBaseName);
		await this.vsCode.dispatchKeybinding('enter');
		// SQL files have a special title that contains the connected status of the query window
		if (path.extname(fileName) === '.sql') {
			await this.waitForQueryEditorFocus(fileName);
		} else {
			await super.waitForEditorFocus(fileName);
		}
	}

	/**
	 * Waits for an active SQL Query Editor tab for the specified file. This is a modification of the editors.waitForActiveTab that
	 * takes into account the connected status displayed in the title of Query Editors.
	 * @param fileName The full path to the file opened in the editor
	 * @param isDirty Whether the file is dirty or not
	 */
	async waitForActiveSqlTab(fileName: string, isDirty: boolean = false): Promise<void> {
		const fileBaseName = path.basename(fileName);
		// For now assume all opened tabs are disconnected until we have a need to open connected tabs
		await this.vsCode.waitForElement(`.tabs-container div.tab.active${isDirty ? '.dirty' : ''}[aria-selected="true"][aria-label="${fileBaseName} - disconnected, tab"]`);
	}


	/**
	 * Waits for an active Query Editor for the specified file to have focus. This is a modification of the editors.waitForEditorFocus
	 * that takes into account the connected status displayed in the title of Query Editors.
	 * @param fileName The full path to the file opened in the editor
	 */
	async waitForQueryEditorFocus(fileName: string): Promise<void> {
		const fileBaseName = path.basename(fileName);
		await this.waitForActiveSqlTab(fileName);
		await super.waitForActiveEditor(fileBaseName);
	}
}
