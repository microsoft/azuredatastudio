/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Editors } from '../editors';
import { Code } from '../code';

export class QueryEditors extends Editors {

	constructor(
		private vsCode: Code
	) {
		super(vsCode);
	}

	/**
	 * Waits for an active SQL Query Editor tab for the specified file. This is a modification of the editors.waitForActiveTab that
	 * takes into account the connected status displayed in the title of Query Editors.
	 * @param fileName The name of the file opened in the editor
	 * @param isDirty Whether the file is dirty or not
	 */
	async waitForActiveTab(fileName: string, isDirty: boolean = false): Promise<void> {
		// For now assume all opened tabs are disconnected until we have a need to open connected tabs
		await this.vsCode.waitForElement(`.tabs-container div.tab.active${isDirty ? '.dirty' : ''}[aria-selected="true"][aria-label="${fileName} - disconnected, tab"]`);
	}

	/**
	 * Waits for an active Query Editor for the specified file to have focus. This is a modification of the editors.waitForEditorFocus
	 * that takes into account the connected status displayed in the title of Query Editors.
	 * @param fileName The name of the file opened in the editor
	 */
	async waitForEditorFocus(fileName: string): Promise<void> {
		await this.waitForActiveTab(fileName);
		await super.waitForActiveEditor(fileName);
	}
}
