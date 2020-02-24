/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';

export class UntitledNotebookInput extends NotebookInput {
	public static ID: string = 'workbench.editorinputs.untitledNotebookInput';

	constructor(
		title: string,
		resource: URI,
		textInput: UntitledTextEditorInput,
		@ITextModelService textModelService: ITextModelService,
		@IInstantiationService instantiationService: IInstantiationService,
		@INotebookService notebookService: INotebookService,
		@IExtensionService extensionService: IExtensionService
	) {
		super(title, resource, textInput, textModelService, instantiationService, notebookService, extensionService);
	}

	public get textInput(): UntitledTextEditorInput {
		return super.textInput as UntitledTextEditorInput;
	}

	public setMode(mode: string): void {
		this.textInput.setMode(mode);
	}

	isUntitled(): boolean {
		// Subclasses need to explicitly opt-in to being untitled.
		return true;
	}

	public getTypeId(): string {
		return UntitledNotebookInput.ID;
	}
}
