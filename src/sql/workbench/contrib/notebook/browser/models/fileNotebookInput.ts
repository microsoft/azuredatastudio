/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { EncodingMode, IFileEditorInput } from 'vs/workbench/common/editor';

export class FileNotebookInput extends NotebookInput implements IFileEditorInput {
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
	setPreferredResource(preferredResource: URI): void {
		this.textInput.setPreferredResource(preferredResource);
	}
	setPreferredName(name: string): void {
		this.textInput.setPreferredName(name);
	}
	setPreferredDescription(description: string): void {
		this.textInput.setPreferredDescription(description);
	}
	setPreferredEncoding(encoding: string): void {
		this.textInput.setPreferredEncoding(encoding);
	}
	setForceOpenAsBinary(): void {
		// Unsupported
		return;
	}
	isResolved(): boolean {
		return this.textInput.isResolved();
	}
	getEncoding(): string {
		return this.textInput.getEncoding();
	}
	setEncoding(encoding: string, mode: EncodingMode): void {
		this.textInput.setEncoding(encoding, mode);
	}
	preferredResource: URI;

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
