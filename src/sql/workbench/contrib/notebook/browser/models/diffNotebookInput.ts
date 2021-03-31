/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { SideBySideEditorInput } from 'vs/workbench/common/editor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { Deferred } from 'sql/base/common/promise';

export class DiffNotebookInput extends SideBySideEditorInput {
	public static ID: string = 'workbench.editorinputs.DiffNotebookInput';
	private _notebookService: INotebookService;

	constructor(
		title: string,
		diffInput: DiffEditorInput,
		@IInstantiationService instantiationService: IInstantiationService,
		@INotebookService notebookService: INotebookService
	) {
		let originalInput = instantiationService.createInstance(FileNotebookInput, diffInput.primary.getName(), diffInput.primary.resource, diffInput.originalInput as FileEditorInput);
		let modifiedInput = instantiationService.createInstance(FileNotebookInput, diffInput.secondary.getName(), diffInput.secondary.resource, diffInput.modifiedInput as FileEditorInput);
		super(title, diffInput.getTitle(), modifiedInput, originalInput);
		this._notebookService = notebookService;
		this.setupScrollListeners(originalInput, modifiedInput);
	}

	public getTypeId(): string {
		return DiffNotebookInput.ID;
	}

	/**
	 * Setup scroll listeners so that both the original and modified editors scroll together
	 * @param originalInput original notebook input
	 * @param modifiedInput modified notebook input
	 */
	private setupScrollListeners(originalInput: FileNotebookInput, modifiedInput: FileNotebookInput): void {
		Promise.all([originalInput.containerResolved, modifiedInput.containerResolved]).then(() => {

			// Setting container height to 100% ensures that scrollbars will be added when in diff mode
			originalInput.container.parentElement.style.height = '100%';
			modifiedInput.container.parentElement.style.height = '100%';

			// Keep track of when original and modified notebooks are shown
			const originalNotebookEditorShown: Deferred<void> = new Deferred<void>();
			const modifiedNotebookEditorShown: Deferred<void> = new Deferred<void>();

			// Possible for notebooks to have been shown already, so check this case
			if (this._notebookService.findNotebookEditor(originalInput.notebookUri)) {
				originalNotebookEditorShown.resolve();
			} else if (this._notebookService.findNotebookEditor(modifiedInput.notebookUri)) {
				modifiedNotebookEditorShown.resolve();
			}

			// If not already shown, listen for add events
			this._notebookService.onNotebookEditorAdd((e) => {
				if (e.id === originalInput.notebookUri.toString()) {
					originalNotebookEditorShown.resolve();
				} else if (e.id === modifiedInput.notebookUri.toString()) {
					modifiedNotebookEditorShown.resolve();
				}
			});

			// Once both are shown, look for scrollable DIV. Add scroll listeners here
			Promise.all([originalNotebookEditorShown.promise, modifiedNotebookEditorShown.promise]).then(() => {
				const originalScrollableNode = originalInput.container?.querySelector('.scrollable');
				const modifiedScrollableNode = modifiedInput.container?.querySelector('.scrollable');

				if (originalScrollableNode && modifiedScrollableNode) {
					originalScrollableNode.addEventListener('scroll', () => {
						modifiedScrollableNode.scroll({ top: originalScrollableNode.scrollTop });
					});
					modifiedScrollableNode.addEventListener('scroll', () => {
						originalScrollableNode.scroll({ top: modifiedScrollableNode.scrollTop });
					});
				}
			});
		});
	}
}
