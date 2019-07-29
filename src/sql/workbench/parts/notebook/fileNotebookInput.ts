/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotebookInput } from 'sql/workbench/parts/notebook/notebookInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

export class FileNotebookInput extends NotebookInput {
	public static ID: string = 'workbench.editorinputs.fileNotebookInput';

	constructor(
		title: string,
		resource: URI,
		textInput: FileEditorInput,
		@ITextModelService textModelService: ITextModelService,
		@IInstantiationService instantiationService: IInstantiationService,
		@INotebookService notebookService: INotebookService,
		@IExtensionService extensionService: IExtensionService
	) {
		super(title, resource, textInput, textModelService, instantiationService, notebookService, extensionService);
	}

	public get textInput(): FileEditorInput {
		return super.textInput as FileEditorInput;
	}

	public getPreferredMode(): string {
		return this.textInput.getPreferredMode();
	}

	public setMode(mode: string): void {
		this.textInput.setMode(mode);
	}

	public setPreferredMode(mode: string): void {
		this.textInput.setPreferredMode(mode);
	}

	public getTypeId(): string {
		return FileNotebookInput.ID;
	}
}
