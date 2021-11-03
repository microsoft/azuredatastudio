/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerTextEditor } from 'sql/base/browser/ui/designer/interfaces';
import { TableDesignerBaseTextEditor } from 'sql/workbench/contrib/tableDesigner/browser/tableDesignerBaseTextEditor';
import { Dimension } from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';

// TODO: Implement the text editor
export class TableDesignerTextEditor implements DesignerTextEditor {
	private _content: string;
	private _readonly: boolean;
	private _contentChangeEventEmitter: Emitter<string> = new Emitter<string>();
	readonly onDidContentChange: Event<string> = this._contentChangeEventEmitter.event;

	private _editor: TableDesignerBaseTextEditor;
	private _untitledTextEditorModel: UntitledTextEditorModel;
	private _editorInput: UntitledTextEditorInput;
	private _editorModel: ITextModel;

	constructor(
		private _container: HTMLElement,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IModelService private _modelService: IModelService
	) {
		this._editor = this._instantiationService.createInstance(TableDesignerBaseTextEditor);
		this._editor.create(this._container);
		this._editor.setVisible(true);
		this._untitledTextEditorModel = this._instantiationService.createInstance(UntitledTextEditorModel, URI.from({ scheme: Schemas.untitled }), false, undefined, 'sql', undefined);
		this._editorInput = this._instantiationService.createInstance(UntitledTextEditorInput, this._untitledTextEditorModel);
		this._editor.setInput(this._editorInput, undefined, undefined);
		this._editorInput.resolve().then((model) => {
			this._editorModel = model.textEditorModel;
		});
	}

	public layout(dimension: Dimension) {
		this._editor.layout(dimension);
	}

	get content(): string {
		return this._content;
	}

	set content(val: string) {
		this._content = val;
		this._modelService.updateModel(this._editorModel, this._content);
		this._contentChangeEventEmitter.fire(this._content);
	}

	get readonly(): boolean {
		return this._readonly;
	}

	set readonly(val: boolean) {
		this._readonly = val;
	}
}
