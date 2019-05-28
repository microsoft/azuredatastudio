/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotebookInput } from 'sql/workbench/parts/notebook/notebookInput';
import { URI } from 'vs/base/common/uri';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';

export class UntitledNotebookInput extends NotebookInput {
	public static ID: string = 'workbench.editorinputs.untitledNotebookInput';

	constructor(
		title: string,
		resource: URI,
		textInput: UntitledEditorInput,
		@ITextModelService textModelService: ITextModelService,
		@IInstantiationService instantiationService: IInstantiationService,
		@INotebookService notebookService: INotebookService,
		@IExtensionService extensionService: IExtensionService
	) {
		super(title, resource, textInput, textModelService, instantiationService, notebookService, extensionService);
	}

	public get textInput(): UntitledEditorInput {
		return super.textInput as UntitledEditorInput;
	}

	public setMode(mode: string): void {
		this.textInput.setMode(mode);
	}

	public getTypeId(): string {
		return UntitledNotebookInput.ID;
	}
}
