/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';
import { QuickInput } from '../quickinput';
import { Editors } from '../editors';

const winOrCtrl = process.platform === 'darwin' ? 'ctrl' : 'win';

export class Notebook {

	public readonly toolbar: NotebookToolbar;

	constructor(private code: Code, private quickAccess: QuickAccess, private quickInput: QuickInput, private editors: Editors) {
		this.toolbar = new NotebookToolbar(code);
	}

	async openFile(fileName: string): Promise<void> {
		await this.quickAccess.openQuickAccess(fileName);
		await this.quickInput.waitForQuickInputElements(names => names[0] === fileName);
		await this.code.dispatchKeybinding('enter');
		await this.editors.waitForActiveTab(fileName);
		await this.code.waitForElement('.notebookEditor');
	}

	async newUntitledNotebook(): Promise<void> {
		await this.code.dispatchKeybinding(winOrCtrl + '+alt+n');
		await this.editors.waitForActiveTab('Notebook-0');
		await this.code.waitForElement('.notebookEditor');
	}

	async addCell(cellType: 'markdown' | 'code'): Promise<void> {
		if (cellType === 'markdown') {
			await this.code.dispatchKeybinding(winOrCtrl + '+shift+t');
		} else {
			await this.code.dispatchKeybinding(winOrCtrl + '+shift+c');
		}

		await this.code.waitForElement('.notebook-cell.active');
	}

	async changeKernel(kernel: string): Promise<void> {
		await this.toolbar.changeKernel(kernel);
	}

	async waitForKernel(kernel: string): Promise<void> {
		await this.toolbar.waitForKernel(kernel);
	}

	async runActiveCell(): Promise<void> {
		await this.code.dispatchKeybinding('F5');
	}

	async runAllCells(): Promise<void> {
		await this.code.dispatchKeybinding(winOrCtrl + '+shift+F5');
	}

	async waitForTypeInEditor(text: string) {
		const editor = '.notebook-cell.active .monaco-editor';
		await this.code.waitAndClick(editor);

		const textarea = `${editor} textarea`;
		await this.code.waitForActiveElement(textarea);

		await this.code.waitForTypeInEditor(textarea, text);
		await this._waitForActiveCellEditorContents(c => c.indexOf(text) > -1);
	}

	private async _waitForActiveCellEditorContents(accept: (contents: string) => boolean): Promise<any> {
		const selector = '.notebook-cell.active .monaco-editor .view-lines';
		return this.code.waitForTextContent(selector, undefined, c => accept(c.replace(/\u00a0/g, ' ')));
	}

	async waitForResults(): Promise<void> {
		const outputComponent = '.notebook-cell.active .notebook-output';
		await this.code.waitForElement(outputComponent);
	}
}

export class NotebookToolbar {

	private static readonly toolbarSelector = '.notebookEditor .editor-toolbar .actions-container';
	constructor(private code: Code) { }

	async changeKernel(kernel: string): Promise<void> {
		const kernelDropdown = `${NotebookToolbar.toolbarSelector} select[id="kernel-dropdown"]`;
		await this.code.waitForSetValue(kernelDropdown, kernel);
		await this.code.dispatchKeybinding('enter');
	}

	async waitForKernel(kernel: string): Promise<void> {
		const kernelDropdownValue = `${NotebookToolbar.toolbarSelector} select[id="kernel-dropdown"][title="${kernel}"]`;
		await this.code.waitForElement(kernelDropdownValue, undefined, 3000); // wait up to 5 minutes for kernel change
	}
}
