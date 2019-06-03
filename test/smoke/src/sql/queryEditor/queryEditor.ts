/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../../vscode/code';
import { Commands } from '../../areas/workbench/workbench';
import { Editor } from '../../areas/editor/editor';
import * as path from 'path';

const EDITOR = filename => `.monaco-editor[data-uri$="${filename}"]`;

export class QueryEditor extends Editor {

	constructor(
		private vsCode: Code,
		commands: Commands
	) {
		super(vsCode, commands);
	}

	/**
	 * Waits for the contents of the editor for the specified file to pass the accept test
	 * @param fileName The name of the file opened in the editor
	 * @param accept The test that is passed the contents of the editor to verify the content is correct
	 */
	async waitForEditorContents(fileName: string, accept: (contents: string) => boolean): Promise<any> {
		const fileBaseName = path.basename(fileName);
		return this.vsCode.waitForTextContent(`${EDITOR(fileBaseName)} .view-lines`, undefined, c => accept(c.replace(/\u00a0/g, ' ')));
	}

	/**
	 * Sends the specified text content to be typed in the editor specified and waits for the view to display that text
	 * @param fileName The name of the file opened in the editor
	 * @param text The text to type
	 * @param selectorPrefix Optional prefix for the editor selector
	 */
	async waitForTypeInEditor(fileName: string, text: string, selectorPrefix = ''): Promise<any> {
		const fileBaseName = path.basename(fileName);
		return super.waitForTypeInEditor(fileBaseName, text, selectorPrefix);
	}
}