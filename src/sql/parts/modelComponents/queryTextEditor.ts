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

import { BaseTextEditor, IEditorConfiguration } from 'vs/workbench/browser/parts/editor/textEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { EditorOptions } from 'vs/workbench/common/editor';
import { StandaloneCodeEditor } from 'vs/editor/standalone/browser/standaloneCodeEditor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Configuration } from 'vs/editor/browser/config/configuration';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class QueryTextEditor extends BaseTextEditor {

	public static ID = 'modelview.editors.textEditor';
	private _dimension: DOM.Dimension;
	private _config: editorCommon.IConfiguration;
	private _minHeight: number = 0;
	private _maxHeight: number = 4000;
	private _selected: boolean;
	private _hideLineNumbers: boolean;
	private _editorWorkspaceConfig;
	private _scrollbarHeight: number;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@ITextFileService textFileService: ITextFileService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IEditorService protected editorService: IEditorService,
		@IWindowService windowService: IWindowService,
		@IWorkspaceConfigurationService private workspaceConfigurationService: IWorkspaceConfigurationService

	) {
		super(
			QueryTextEditor.ID, telemetryService, instantiationService, storageService,
			configurationService, themeService, textFileService, editorService, editorGroupService, windowService);
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
			options.renderIndentGuides = false;
			options.rulers = [];
			options.glyphMargin = true;
			options.minimap = {
				enabled: false
			};
			options.overviewRulerLanes = 0;
			options.overviewRulerBorder = false;
			options.hideCursorInOverviewRuler = true;
			if (!this._selected) {
				options.renderLineHighlight = 'none';
				options.parameterHints = { enabled: false };
				options.matchBrackets = false;
			}
			if (this._hideLineNumbers) {
				options.lineNumbers = 'off';
			}
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

	public setHeightToScrollHeight(configChanged?: boolean): void {
		let editorWidget = this.getControl() as ICodeEditor;
		if (!this._config) {
			this._config = new Configuration(undefined, editorWidget.getDomNode());
			this._scrollbarHeight = this._config.editor.viewInfo.scrollbar.horizontalScrollbarSize;
		}
		let editorWidgetModel = editorWidget.getModel();
		if (!editorWidgetModel) {
			// Not ready yet
			return;
		}
		let lineCount = editorWidgetModel.getLineCount();
		// Need to also keep track of lines that wrap; if we just keep into account line count, then the editor's height would not be
		// tall enough and we would need to show a scrollbar. Unfortunately, it looks like there isn't any metadata saved in a ICodeEditor
		// around max column length for an editor (which we could leverage to see if we need to loop through every line to determine
		// number of lines that wrap). Finally, viewportColumn is calculated on editor resizing automatically; we can use it to ensure
		// that the viewportColumn will always be greater than any character's column in an editor.
		let numberWrappedLines = 0;
		let shouldAddHorizontalScrollbarHeight = false;
		if (!this._editorWorkspaceConfig || configChanged) {
			this._editorWorkspaceConfig = this.workspaceConfigurationService.getValue('editor');
		}
		let wordWrapEnabled: boolean = this._editorWorkspaceConfig && this._editorWorkspaceConfig['wordWrap'] && this._editorWorkspaceConfig['wordWrap'] === 'on' ? true : false;
		if (wordWrapEnabled) {
			for (let line = 1; line <= lineCount; line++) {
				// 4 columns is equivalent to the viewport column width and the edge of the editor
				if (editorWidgetModel.getLineMaxColumn(line) >= this._config.editor.layoutInfo.viewportColumn + 4) {
					numberWrappedLines += Math.ceil(editorWidgetModel.getLineMaxColumn(line) / this._config.editor.layoutInfo.viewportColumn);
				}
			}
		} else {
			for (let line = 1; line <= lineCount; line++) {
				// The horizontal scrollbar always appears 1 column past the viewport column when word wrap is disabled
				if (editorWidgetModel.getLineMaxColumn(line) >= this._config.editor.layoutInfo.viewportColumn + 1) {
					shouldAddHorizontalScrollbarHeight = true;
					break;
				}
			}
		}
		let editorHeightUsingLines = this._config.editor.lineHeight * (lineCount + numberWrappedLines);
		let editorHeightUsingMinHeight = Math.max(Math.min(editorHeightUsingLines, this._maxHeight), this._minHeight);
		editorHeightUsingMinHeight = shouldAddHorizontalScrollbarHeight ? editorHeightUsingMinHeight + this._scrollbarHeight : editorHeightUsingMinHeight;
		this.setHeight(editorHeightUsingMinHeight);
	}

	public setMinimumHeight(height: number) : void {
		this._minHeight = height;
	}

	public setMaximumHeight(height: number) : void {
		this._maxHeight = height;
	}

	public toggleEditorSelected(selected: boolean): void {
		this._selected = selected;
		this.refreshEditorConfguration();
	}

	public set hideLineNumbers(value: boolean) {
		this._hideLineNumbers = value;
		this.refreshEditorConfguration();
	}

	private refreshEditorConfguration(configuration = this.configurationService.getValue<IEditorConfiguration>(this.getResource())): void {
		if (!this.getControl()) {
			return;
		}

		const editorConfiguration = this.computeConfiguration(configuration);
		let editorSettingsToApply = editorConfiguration;
		this.getControl().updateOptions(editorSettingsToApply);
	}
}
