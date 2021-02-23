/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';
import { QuickInput } from '../quickinput';
import { Editors } from '../editors';
import { IElement } from '..';

const winOrCtrl = process.platform === 'darwin' ? 'ctrl' : 'win';

export class Notebook {

	public readonly toolbar: NotebookToolbar;

	constructor(private code: Code, private quickAccess: QuickAccess, private quickInput: QuickInput, private editors: Editors) {
		this.toolbar = new NotebookToolbar(code);
	}

	async openFile(fileName: string): Promise<void> {
		await this.quickAccess.openQuickAccess(fileName);
		await this.quickInput.waitForQuickInputElements(names => names[0] === fileName);
		await this.code.waitAndClick('.quick-input-widget .quick-input-list .monaco-list-row');
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

	async clearResults(): Promise<void> {
		await this.code.waitAndClick('.notebookEditor');
		const clearResultsButton = '.editor-toolbar a[class="action-label codicon icon-clear-results masked-icon"]';
		await this.code.waitAndClick(clearResultsButton);
	}

	async trustNotebook(): Promise<void> {
		await this.toolbar.trustNotebook();
	}

	async waitForTrustedIcon(): Promise<void> {
		await this.toolbar.waitForTrustedIcon();
	}

	async waitForNotTrustedIcon(): Promise<void> {
		await this.toolbar.waitForNotTrustedIcon();
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

	async waitForActiveCellResults(): Promise<void> {
		const outputComponent = '.notebook-cell.active .notebook-output';
		await this.code.waitForElement(outputComponent);
	}

	async waitForResults(cellIds: string[]): Promise<void> {
		for (let i of cellIds) {
			await this.code.waitForElement(`div.notebook-cell[id="${i}"] .notebook-output`);
		}
	}

	async waitForAllResults(): Promise<void> {
		let cellIds: string[] = [];
		await this.code.waitForElements('div.notebook-cell', false, result => {
			cellIds = result.map(cell => cell.attributes['id']);
			return true;
		});
		await this.waitForResults(cellIds);
	}

	async waitForActiveCellResultsGone(): Promise<void> {
		const outputComponent = '.notebook-cell.active .notebook-output';
		await this.code.waitForElementGone(outputComponent);
	}

	async waitForResultsGone(cellIds: string[]): Promise<void> {
		for (let i of cellIds) {
			await this.code.waitForElementGone(`div.notebook-cell[id="${i}"] .notebook-output`);
		}
	}

	async waitForAllResultsGone(): Promise<void> {
		let cellIds: string[] = [];
		await this.code.waitForElements('div.notebook-cell', false, result => {
			cellIds = result.map(cell => cell.attributes['id']);
			return true;
		});
		await this.waitForResultsGone(cellIds);
	}

	async waitForTrustedElements(): Promise<void> {
		const cellSelector = '.notebookEditor .notebook-cell';
		await this.code.waitForElement(`${cellSelector} iframe`);
		await this.code.waitForElement(`${cellSelector} dialog`);
		await this.code.waitForElement(`${cellSelector} embed`);
		await this.code.waitForElement(`${cellSelector} svg`);
	}

	async waitForTrustedElementsGone(): Promise<void> {
		const cellSelector = '.notebookEditor .notebook-cell';
		await this.code.waitForElementGone(`${cellSelector} iframe`);
		await this.code.waitForElementGone(`${cellSelector} dialog`);
		await this.code.waitForElementGone(`${cellSelector} embed`);
		await this.code.waitForElementGone(`${cellSelector} svg`);
	}
}

export class NotebookToolbar {

	private static readonly toolbarSelector = '.notebookEditor .editor-toolbar .actions-container';
	private static readonly toolbarButtonSelector = `${NotebookToolbar.toolbarSelector} a.action-label.codicon.masked-icon`;
	private static readonly trustedButtonClass = 'action-label codicon masked-icon icon-shield';
	private static readonly trustedButtonSelector = `${NotebookToolbar.toolbarSelector} a[class="${NotebookToolbar.trustedButtonClass}"]`;
	private static readonly notTrustedButtonClass = 'action-label codicon masked-icon icon-shield-x';
	private static readonly notTrustedButtonSelector = `${NotebookToolbar.toolbarSelector} a[class="${NotebookToolbar.notTrustedButtonClass}"]`;

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

	async trustNotebook(): Promise<void> {
		await this.code.waitAndClick(NotebookToolbar.toolbarSelector);

		let buttons: IElement[] = await this.code.waitForElements(NotebookToolbar.toolbarButtonSelector, false);
		buttons.forEach(async button => {
			if (button.className.includes('icon-shield-x')) {
				await this.code.waitAndClick(NotebookToolbar.notTrustedButtonSelector);
				return;
			} else if (button.className.includes('icon-shield')) { // notebook is already trusted
				return;
			}
		});
	}

	async waitForTrustedIcon(): Promise<void> {
		await this.code.waitForElement(NotebookToolbar.trustedButtonSelector);
	}

	async waitForNotTrustedIcon(): Promise<void> {
		await this.code.waitForElement(NotebookToolbar.notTrustedButtonSelector);
	}
}
