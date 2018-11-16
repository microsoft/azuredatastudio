/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { ResourceEditorModel } from 'vs/workbench/common/editor/resourceEditorModel';
import * as editorCommon from 'vs/editor/common/editorCommon';

import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { EditorOptions } from 'vs/workbench/common/editor';
import { StandaloneCodeEditor } from 'vs/editor/standalone/browser/standaloneCodeEditor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Configuration } from 'vs/editor/browser/config/configuration';

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class QueryTextEditor extends BaseTextEditor {

	public static ID = 'modelview.editors.textEditor';
	private _dimension: DOM.Dimension;
	private _config: editorCommon.IConfiguration;
	private _minHeight: number;
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IModeService modeService: IModeService,
		@ITextFileService textFileService: ITextFileService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IEditorService protected editorService: IEditorService,

	) {
		super(
			QueryTextEditor.ID, telemetryService, instantiationService, storageService,
			configurationService, themeService, textFileService, editorService, editorGroupService);
	}

	public createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		return this.instantiationService.createInstance(StandaloneCodeEditor, parent, configuration);
	}

	protected getConfigurationOverrides(): IEditorOptions {
		const options = super.getConfigurationOverrides();
		if (this.input) {
			options.inDiffEditor = true;
			options.scrollBeyondLastLine = false;
			options.folding = false;
			options.renderWhitespace = 'none';
			options.wordWrap = 'on';
			options.renderIndentGuides = false;
			options.rulers = [];
			options.glyphMargin = true;
			options.minimap = {
				enabled: false
			};
			options.overviewRulerLanes = 0;
			options.overviewRulerBorder = false;
			options.hideCursorInOverviewRuler = true;
		}
		return options;
	}

	setInput(input: UntitledEditorInput, options: EditorOptions): Thenable<void> {
		return super.setInput(input, options, CancellationToken.None)
			.then(() => this.input.resolve()
				.then(editorModel => editorModel.load())
				.then(editorModel => this.getControl().setModel((<ResourceEditorModel>editorModel).textEditorModel)));
	}

	protected getAriaLabel(): string {
		return nls.localize('queryTextEditorAriaLabel', 'modelview code editor for view model.');
	}

	public layout(dimension?: DOM.Dimension){
		if (dimension) {
			this._dimension = dimension;
		}
		this.getControl().layout(dimension);
	}

	public setWidth(width: number) {
		if (this._dimension) {
			this._dimension.width = width;
			this.layout();
		}
	}

	public setHeight(height: number) {
		if (this._dimension) {
			this._dimension.height = height;
			this.layout(this._dimension);
		}
	}

	public get scrollHeight(): number {
		let editorWidget = this.getControl() as ICodeEditor;
		return editorWidget.getScrollHeight();
	}

	public setHeightToScrollHeight(): void {
		let editorWidget = this.getControl() as ICodeEditor;
		if (!this._config) {
			this._config = new Configuration(undefined, editorWidget.getDomNode());
		}
		let editorHeightUsingLines = this._config.editor.lineHeight * editorWidget.getModel().getLineCount();
		let editorHeightUsingMinHeight = Math.max(editorHeightUsingLines, this._minHeight);
		this.setHeight(editorHeightUsingMinHeight);
	}

	public setMinimumHeight(height: number) : void {
		this._minHeight = height;
	}
}
