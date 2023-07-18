/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions, EditorOption } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { TextResourceEditorModel } from 'vs/workbench/common/editor/textResourceEditorModel';
import * as editorCommon from 'vs/editor/common/editorCommon';

import { IEditorConfiguration } from 'vs/workbench/browser/parts/editor/textEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfiguration';
import { AbstractTextCodeEditor } from 'vs/workbench/browser/parts/editor/textCodeEditor';
import { IFileService } from 'vs/platform/files/common/files';

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class QueryTextEditor extends AbstractTextCodeEditor<editorCommon.ICodeEditorViewState> {

	public static ID = 'modelview.editors.textEditor';
	private _dimension: DOM.Dimension;
	private _minHeight: number = 0;
	private _maxHeight: number = 4000;
	private _selected: boolean;
	private _hideLineNumbers: boolean;
	private _scrollbarHeight: number;
	private _lineHeight: number;
	private _shouldAddHorizontalScrollbarHeight: boolean = false;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IEditorService editorService: IEditorService,
		@IFileService fileService: IFileService
	) {
		super(
			QueryTextEditor.ID, telemetryService, instantiationService, storageService,
			configurationService, themeService, editorService, editorGroupService, fileService);
	}

	protected override createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		this.editorControl = this.instantiationService.createInstance(CodeEditorWidget, parent, configuration, {});

		return this.editorControl;
	}

	protected override getConfigurationOverrides(): IEditorOptions {
		const options = super.getConfigurationOverrides();
		if (this.input) {
			options.inDiffEditor = false;
			options.scrollBeyondLastLine = false;
			options.folding = false;
			options.guides = { indentation: false };
			options.rulers = [];
			options.glyphMargin = true;
			options.minimap = {
				enabled: false
			};
			options.scrollbar = {
				alwaysConsumeMouseWheel: false
			};
			options.overviewRulerLanes = 0;
			options.overviewRulerBorder = false;
			options.hideCursorInOverviewRuler = true;
			if (!this._selected) {
				options.renderLineHighlight = 'none';
				options.parameterHints = { enabled: false };
				options.matchBrackets = 'never';
			}
			if (this._hideLineNumbers) {
				options.lineNumbers = 'off';
			}
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
		return nls.localize('queryTextEditorAriaLabel', "modelview code editor for view model.");
	}

	public override layout(dimension?: DOM.Dimension) {
		if (dimension) {
			this._dimension = dimension;
		}
		this.getControl().layout(dimension);
	}

	public setWidth(width: number) {
		if (this._dimension) {
			this._dimension = new DOM.Dimension(width, this._dimension.height);
			this.layout();
		}
	}

	public setHeight(height: number) {
		if (this._dimension) {
			this._dimension = new DOM.Dimension(this._dimension.width, height);
			this.layout(this._dimension);
		}
	}

	public get scrollHeight(): number {
		let editorWidget = this.getControl() as ICodeEditor;
		return editorWidget.getScrollHeight();
	}

	public get shouldAddHorizontalScrollbar(): boolean {
		return this._shouldAddHorizontalScrollbarHeight;
	}

	public setHeightToScrollHeight(configChanged?: boolean, isEditorCollapsed?: boolean,) {
		let editorWidget = this.getControl() as ICodeEditor;
		let layoutInfo = editorWidget.getLayoutInfo();
		if (!this._scrollbarHeight) {
			this._scrollbarHeight = layoutInfo.horizontalScrollbarHeight;
		}
		let editorWidgetModel = editorWidget.getModel();
		if (!editorWidgetModel) {
			// Not ready yet
			return;
		}
		let lineCount: number;
		if (!!isEditorCollapsed) {
			lineCount = 1;
		} else {
			lineCount = editorWidgetModel.getLineCount();
		}
		// Need to also keep track of lines that wrap; if we just keep into account line count, then the editor's height would not be
		// tall enough and we would need to show a scrollbar. Unfortunately, it looks like there isn't any metadata saved in a ICodeEditor
		// around max column length for an editor (which we could leverage to see if we need to loop through every line to determine
		// number of lines that wrap). Finally, viewportColumn is calculated on editor resizing automatically; we can use it to ensure
		// that the viewportColumn will always be greater than any character's column in an editor.
		let numberWrappedLines = 0;
		this._shouldAddHorizontalScrollbarHeight = false;
		if (!this._lineHeight || configChanged) {
			this._lineHeight = editorWidget.getOption(EditorOption.lineHeight) || 18;
		}
		if (layoutInfo.isViewportWrapping) {
			for (let line = 1; line <= lineCount; line++) {
				// 2 columns is equivalent to the viewport column width and the edge of the editor
				if (editorWidgetModel.getLineMaxColumn(line) >= layoutInfo.viewportColumn + 2) {
					// Subtract 1 because the first line should not count as a wrapped line
					numberWrappedLines += Math.ceil(editorWidgetModel.getLineMaxColumn(line) / layoutInfo.viewportColumn) - 1;
				}
			}
		} else {
			for (let line = 1; line <= lineCount; line++) {
				// The horizontal scrollbar always appears 1 column past the viewport column when word wrap is disabled
				if (editorWidgetModel.getLineMaxColumn(line) >= layoutInfo.viewportColumn + 1) {
					this._shouldAddHorizontalScrollbarHeight = true;
					break;
				}
			}
		}
		let editorHeightUsingLines = this._lineHeight * (lineCount + numberWrappedLines);
		let editorHeightUsingMinHeight = Math.max(Math.min(editorHeightUsingLines, this._maxHeight), this._minHeight);
		editorHeightUsingMinHeight = this._shouldAddHorizontalScrollbarHeight ? editorHeightUsingMinHeight + this._scrollbarHeight : editorHeightUsingMinHeight;
		this.setHeight(editorHeightUsingMinHeight);
	}

	public setMinimumHeight(height: number): void {
		this._minHeight = height;
	}

	public setMaximumHeight(height: number): void {
		this._maxHeight = height;
	}

	public toggleEditorSelected(selected: boolean): void {
		this._selected = selected;
		this.refreshEditorConfiguration();
	}

	public set hideLineNumbers(value: boolean) {
		this._hideLineNumbers = value;
		this.refreshEditorConfiguration();
	}

	private refreshEditorConfiguration(configuration = this.textResourceConfigurationService.getValue<IEditorConfiguration>(this.input.resource)): void {
		if (!this.getControl()) {
			return;
		}

		const editorConfiguration = this.computeConfiguration(configuration);
		let editorSettingsToApply = editorConfiguration;
		this.getControl().updateOptions(editorSettingsToApply);
	}

	protected override tracksEditorViewState(input: EditorInput): boolean {
		return input.typeId === QueryTextEditor.ID;
	}
}
