/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerTextEditor } from 'sql/workbench/browser/designer/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { TextResourceEditorModel } from 'vs/workbench/common/editor/textResourceEditorModel';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { onUnexpectedError } from 'vs/base/common/errors';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';

class DesignerCodeEditor extends CodeEditorWidget {
}

let DesignerScriptEditorInstanceId = 0;

export class DesignerScriptEditor extends BaseTextEditor<editorCommon.ICodeEditorViewState> implements DesignerTextEditor {
	private _content: string;
	private _contentChangeEventEmitter: Emitter<string> = new Emitter<string>();
	readonly onDidContentChange: Event<string> = this._contentChangeEventEmitter.event;

	private _untitledTextEditorModel: UntitledTextEditorModel;
	private _editorInput: UntitledTextEditorInput;
	private _editorModel: ITextModel;

	public static ID = 'designer.editors.textEditor';
	constructor(
		private _container: HTMLElement,
		@IModelService private _modelService: IModelService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService
	) {
		super(DesignerScriptEditor.ID, telemetryService, instantiationService, storageService, configurationService, themeService, editorService, editorGroupService);
		this.create(this._container);
		this.setVisible(true);
		this._untitledTextEditorModel = this.instantiationService.createInstance(UntitledTextEditorModel, URI.from({ scheme: Schemas.untitled, path: `DesignerScriptEditor-${DesignerScriptEditorInstanceId++}` }), false, undefined, 'sql', undefined);
		this._editorInput = this.instantiationService.createInstance(UntitledTextEditorInput, this._untitledTextEditorModel);
		this.setInput(this._editorInput, undefined, undefined).catch(onUnexpectedError);
		this._editorInput.resolve().then((model) => {
			this._editorModel = model.textEditorModel;
			this.updateEditor();
		});
	}

	public override createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		return this.instantiationService.createInstance(DesignerCodeEditor, parent, configuration, {});
	}

	protected override getConfigurationOverrides(): IEditorOptions {
		const options = super.getConfigurationOverrides();
		options.readOnly = true;
		if (this.input) {
			options.inDiffEditor = false;
			options.scrollBeyondLastLine = false;
			options.folding = false;
			options.renderWhitespace = 'all';
			options.wordWrap = 'off';
			options.guides = { indentation: false };
			options.rulers = [];
			options.glyphMargin = true;
		}
		return options;
	}

	override async setInput(input: UntitledTextEditorInput, options: ITextEditorOptions, context: IEditorOpenContext): Promise<void> {
		await super.setInput(input, options, context, CancellationToken.None);
		const editorModel = await this.input.resolve() as TextResourceEditorModel;
		await editorModel.resolve();
		this.getControl().setModel(editorModel.textEditorModel);
	}

	protected getAriaLabel(): string {
		return nls.localize('designer.textEditorAriaLabel', "Designer text editor.");
	}

	public override layout(dimension: DOM.Dimension) {
		this.getControl().layout(dimension);
	}

	get content(): string {
		return this._content;
	}

	set content(val: string) {
		this._content = val;
		this.updateEditor();
	}

	private updateEditor(): void {
		if (this._editorModel && this._content) {
			this._modelService.updateModel(this._editorModel, this._content);
			this._untitledTextEditorModel.setDirty(false);
			this.layout(new DOM.Dimension(this._container.clientWidth, this._container.clientHeight));
		}
	}

	protected tracksEditorViewState(input: EditorInput): boolean {
		return input.typeId === DesignerScriptEditor.ID;
	}
}
