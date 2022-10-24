/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IResourceEditorInput } from 'vs/platform/editor/common/editor';

export class FileNotebookInput extends NotebookInput {
	public static ID: string = 'workbench.editorinputs.fileNotebookInput';

	constructor(
		title: string,
		resource: URI,
		textInput: FileEditorInput,
		showActions: boolean,
		@ITextModelService textModelService: ITextModelService,
		@IInstantiationService instantiationService: IInstantiationService,
		@INotebookService notebookService: INotebookService,
		@IExtensionService extensionService: IExtensionService
	) {
		super(title, resource, textInput, showActions, textModelService, instantiationService, notebookService, extensionService);
	}

	public override get textInput(): FileEditorInput {
		return super.textInput as FileEditorInput;
	}

	public getPreferredMode(): string {
		return this.textInput.getPreferredLanguageId();
	}

	public setMode(mode: string): void {
		this.textInput.setLanguageId(mode);
	}

	public setPreferredMode(mode: string): void {
		this.textInput.setPreferredLanguageId(mode);
	}

	override get typeId(): string {
		return FileNotebookInput.ID;
	}

	public getEncoding(): string | undefined {
		return this.textInput.getEncoding();
	}

	override toUntyped(): IResourceEditorInput {
		return <IResourceEditorInput>{
			resource: this.resource
		};
	}
}
