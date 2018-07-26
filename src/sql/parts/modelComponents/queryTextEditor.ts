/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { TPromise } from 'vs/base/common/winjs.base';
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
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { EditorOptions } from 'vs/workbench/common/editor';
import { CodeEditor } from 'vs/editor/browser/codeEditor';
import { IEditorContributionCtor } from 'vs/editor/browser/editorExtensions';
import { FoldingController } from 'vs/editor/contrib/folding/folding';

class QueryCodeEditor extends CodeEditor {

	protected _getContributions(): IEditorContributionCtor[] {
		let contributions = super._getContributions();
		let skipContributions = [FoldingController.prototype];
		contributions = contributions.filter(c => skipContributions.indexOf(c.prototype) === -1);
		return contributions;
	}

}

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class QueryTextEditor extends BaseTextEditor {

	public static ID = 'modelview.editors.textEditor';
	private _dimension: DOM.Dimension;
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IModeService modeService: IModeService,
		@ITextFileService textFileService: ITextFileService,
		@IEditorGroupService editorGroupService: IEditorGroupService

	) {
		super(QueryTextEditor.ID, telemetryService, instantiationService, storageService, configurationService, themeService, textFileService, editorGroupService);
	}

	public createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		return this.instantiationService.createInstance(QueryCodeEditor, parent, configuration);
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
		}
		return options;
	}

	setInput(input: UntitledEditorInput, options: EditorOptions): TPromise<void> {
		return super.setInput(input, options)
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
			this.layout();
		}
	}
}
