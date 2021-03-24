/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { SideBySideEditorInput } from 'vs/workbench/common/editor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';

export class DiffNotebookInput extends SideBySideEditorInput {
	public static ID: string = 'workbench.editorinputs.DiffNotebookInput';
	private _originalInput: FileNotebookInput;
	private _modifiedInput: FileNotebookInput;

	constructor(
		title: string,
		diffInput: DiffEditorInput,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		let originalInput = instantiationService.createInstance(FileNotebookInput, diffInput.primary.getName(), diffInput.primary.resource, diffInput.originalInput as FileEditorInput);
		let modifiedInput = instantiationService.createInstance(FileNotebookInput, diffInput.secondary.getName(), diffInput.secondary.resource, diffInput.modifiedInput as FileEditorInput);
		super(title, diffInput?.getTitle(), originalInput, modifiedInput);
		this._originalInput = originalInput;
		this._modifiedInput = modifiedInput;
		this.setupListerners();
	}

	public getTypeId(): string {
		return DiffNotebookInput.ID;
	}

	private setupListerners(): void {
		Promise.all([this._originalInput.resolve(),
		this._modifiedInput.resolve()]).then(() => {

			this._originalInput.container.parentElement.parentElement.addEventListener('scroll', (e) => {
				if (this._modifiedInput?.container) {
					this._modifiedInput.container.parentElement.parentElement.scroll({ top: this._originalInput.container.parentElement.parentElement.scrollTop });
				}
			});
			// this._originalInput.container.firstElementChild[0].onscroll = (e) => {
			// 	if (this._modifiedInput?.container?.firstElementChild[0]) {
			// 		this._modifiedInput.container.firstElementChild[0].scroll({ top: this._originalInput.container.firstElementChild[0].scrollTop });
			// 	}
			// };
		});
	}
}
