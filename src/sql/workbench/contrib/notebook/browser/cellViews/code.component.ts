/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, ElementRef, ViewChild, Output, EventEmitter, OnChanges, SimpleChange, forwardRef, ChangeDetectorRef } from '@angular/core';

import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { ICellModel, CellExecutionState } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { RunCellAction, CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import * as DOM from 'vs/base/browser/dom';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Event, Emitter } from 'vs/base/common/event';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { OVERRIDE_EDITOR_THEMING_SETTING } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ILogService } from 'vs/platform/log/common/log';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IEditorProgressService } from 'vs/platform/progress/common/progress';
import { SimpleProgressIndicator } from 'sql/workbench/services/progress/browser/simpleProgressIndicator';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { tryMatchCellMagic } from 'sql/workbench/services/notebook/browser/utils';
import { IColorTheme } from 'vs/platform/theme/common/themeService';

export const CODE_SELECTOR: string = 'code-component';
const MARKDOWN_CLASS = 'markdown';
const DEFAULT_OR_LOCAL_CONTEXT_ID = '-1';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./code.component.html'))
})
export class CodeComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('toolbar', { read: ElementRef }) private toolbarElement: ElementRef;
	@ViewChild('editor', { read: ElementRef }) private codeElement: ElementRef;

	public get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() public set cellModel(value: ICellModel) {
		this._cellModel = value;
		if (this.toolbarElement && value && value.cellType === CellTypes.Markdown) {
			let nativeToolbar = <HTMLElement>this.toolbarElement.nativeElement;
			DOM.addClass(nativeToolbar, MARKDOWN_CLASS);
		}
	}

	@Output() public onContentChanged = new EventEmitter<void>();

	@Input() set model(value: NotebookModel) {
		this._model = value;
		this._register(value.kernelChanged(() => {
			// On kernel change, need to reevaluate the language for each cell
			// Refresh based on the cell magic (since this is kernel-dependent) and then update using notebook language
			this.checkForLanguageMagics();
			this.updateLanguageMode();
		}));
		this._register(value.onValidConnectionSelected(() => {
			this.updateConnectionState(this.isActive());
		}));
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@Input() set hover(value: boolean) {
		this.cellModel.hover = value;
	}

	protected _actionBar: Taskbar;
	private readonly _minimumHeight = 30;
	private readonly _maximumHeight = 4000;
	private _cellModel: ICellModel;
	private _editor: QueryTextEditor;
	private _editorInput: UntitledTextEditorInput;
	private _editorModel: ITextModel;
	private _model: NotebookModel;
	private _activeCellId: string;
	private _layoutEmitter = new Emitter<void>();

	constructor(
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(ILogService) private readonly logService: ILogService
	) {
		super();
		this._register(Event.debounce(this._layoutEmitter.event, (l, e) => e, 250, /*leading=*/false)
			(() => this.layout()));
		// Handle disconnect on removal of the cell, if it was the active cell
		this._register({ dispose: () => this.updateConnectionState(false) });
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.initActionBar();
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		this.updateLanguageMode();
		this.updateModel();
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				let isActive = this.cellModel.id === changedProp.currentValue;
				this.updateConnectionState(isActive);
				if (this._editor) {
					this._editor.toggleEditorSelected(isActive);
				}
				break;
			}
		}
	}

	public getEditor(): QueryTextEditor {
		return this._editor;
	}

	public hasEditor(): boolean {
		return true;
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}

	private updateConnectionState(shouldConnect: boolean) {
		if (this.isSqlCodeCell()) {
			let cellUri = this.cellModel.cellUri.toString();
			let connectionService = this.connectionService;
			if (!shouldConnect && connectionService && connectionService.isConnected(cellUri)) {
				connectionService.disconnect(cellUri).catch(e => this.logService.error(e));
			} else if (shouldConnect && this._model.context && this._model.context.id !== DEFAULT_OR_LOCAL_CONTEXT_ID) {
				connectionService.connect(this._model.context, cellUri).catch(e => this.logService.error(e));
			}
		}
	}

	private get connectionService(): IConnectionManagementService {
		return this._model && this._model.notebookOptions && this._model.notebookOptions.connectionService;
	}

	private isSqlCodeCell() {
		return this._model
			&& this._model.defaultKernel
			&& this._model.defaultKernel.display_name === notebookConstants.SQL
			&& this.cellModel.cellType === CellTypes.Code
			&& this.cellModel.cellUri;
	}

	private get destroyed(): boolean {
		return !!(this._changeRef['destroyed']);
	}

	ngAfterContentInit(): void {
		if (this.destroyed) {
			return;
		}
		this.createEditor().catch(e => this.logService.error(e));
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this._layoutEmitter.fire();
		}));
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private async createEditor(): Promise<void> {
		const customInstan = this._instantiationService.createChild(new ServiceCollection([IEditorProgressService, new SimpleProgressIndicator()]));
		this._editor = customInstan.createInstance(QueryTextEditor);
		this._editor.create(this.codeElement.nativeElement);
		this._editor.setVisible(true);
		this._editor.setMinimumHeight(this._minimumHeight);
		this._editor.setMaximumHeight(this._maximumHeight);

		let uri = this.cellModel.cellUri;
		let cellModelSource: string;
		cellModelSource = Array.isArray(this.cellModel.source) ? this.cellModel.source.join('') : this.cellModel.source;
		const model = this._instantiationService.createInstance(UntitledTextEditorModel, uri, false, cellModelSource, this.cellModel.language, undefined);
		this._editorInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
		await this._editor.setInput(this._editorInput, undefined);
		this.setFocusAndScroll();

		let untitledEditorModel = await this._editorInput.resolve() as UntitledTextEditorModel;
		this._editorModel = untitledEditorModel.textEditorModel;

		let isActive = this.cellModel.id === this._activeCellId;
		this._editor.toggleEditorSelected(isActive);

		// For markdown cells, don't show line numbers unless we're using editor defaults
		let overrideEditorSetting = this._configurationService.getValue<boolean>(OVERRIDE_EDITOR_THEMING_SETTING);
		this._editor.hideLineNumbers = (overrideEditorSetting && this.cellModel.cellType === CellTypes.Markdown);

		if (this.destroyed) {
			// At this point, we may have been disposed (scenario: restoring markdown cell in preview mode).
			// Exiting early to avoid warnings on registering already disposed items, which causes some churning
			// due to re-disposing things.
			// There's no negative impact as at this point the component isn't visible (it was removed from the DOM)
			return;
		}
		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel.onDidChangeContent(e => {
			this.cellModel.modelContentChangedEvent = e;

			let originalSourceLength = this.cellModel.source.length;
			this.cellModel.source = this._editorModel.getValue();
			if (this._cellModel.isCollapsed && originalSourceLength !== this.cellModel.source.length) {
				this._cellModel.isCollapsed = false;
			}
			this._editor.setHeightToScrollHeight(false, this._cellModel.isCollapsed);

			this.onContentChanged.emit();
			this.checkForLanguageMagics();
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('editor.wordWrap') || e.affectsConfiguration('editor.fontSize')) {
				this._editor.setHeightToScrollHeight(true, this._cellModel.isCollapsed);
			}
		}));
		this._register(this.model.layoutChanged(() => this._layoutEmitter.fire(), this));
		this._register(this.cellModel.onExecutionStateChange(event => {
			if (event === CellExecutionState.Running && !this.cellModel.stdInVisible) {
				this.setFocusAndScroll();
			}
		}));
		this._register(this.cellModel.onCollapseStateChanged(isCollapsed => {
			this.onCellCollapse(isCollapsed);
		}));

		this._register(this.cellModel.onCellPreviewChanged(() => {
			this._layoutEmitter.fire();
		}));

		this.layout();

		if (this._cellModel.isCollapsed) {
			this.onCellCollapse(true);
		}
	}

	public layout(): void {
		this._editor.layout(new DOM.Dimension(
			DOM.getContentWidth(this.codeElement.nativeElement),
			DOM.getContentHeight(this.codeElement.nativeElement)));
		this._editor.setHeightToScrollHeight(false, this._cellModel.isCollapsed);
	}

	protected initActionBar() {
		let context = new CellContext(this.model, this.cellModel);
		let runCellAction = this._instantiationService.createInstance(RunCellAction, context);

		let taskbar = <HTMLElement>this.toolbarElement.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = context;
		this._actionBar.setContent([
			{ action: runCellAction }
		]);
	}

	/// Editor Functions
	private updateModel() {
		if (this._editorModel) {
			let cellModelSource: string;
			cellModelSource = Array.isArray(this.cellModel.source) ? this.cellModel.source.join('') : this.cellModel.source;
			this._modelService.updateModel(this._editorModel, cellModelSource);
		}
	}

	private checkForLanguageMagics(): void {
		try {
			if (!this.cellModel || this.cellModel.cellType !== CellTypes.Code) {
				return;
			}
			if (this._editorModel && this._editor && this._editorModel.getLineCount() > 1) {
				// Only try to match once we've typed past the first line
				let magicName = tryMatchCellMagic(this._editorModel.getLineContent(1));
				if (magicName) {
					let kernelName = this._model.clientSession && this._model.clientSession.kernel ? this._model.clientSession.kernel.name : undefined;
					let magic = this._model.notebookOptions.cellMagicMapper.toLanguageMagic(magicName, kernelName);
					if (magic && this.cellModel.language !== magic.language) {
						this.cellModel.setOverrideLanguage(magic.language);
						this.updateLanguageMode();
					}
				} else {
					this.cellModel.setOverrideLanguage(undefined);
				}
			}
		} catch (err) {
			// No-op for now. Should we log?
		}
	}

	private updateLanguageMode(): void {
		if (this._editorModel && this._editor) {
			let modeValue = this._modeService.create(this.cellModel.language);
			this._modelService.setMode(this._editorModel, modeValue);
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbarElement.nativeElement;
		toolbarEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	private setFocusAndScroll(): void {
		// If offsetParent is null, the element isn't visible
		// In this case, we don't want a cell to grab focus for an editor that isn't in the foreground.
		// In addition, ensure that the ownerDocument itself has focus for scenarios where ADS isn't in the foreground
		let ownerDocument = this._editor.getContainer().ownerDocument;
		if (this.cellModel.id === this._activeCellId && this._editor.getContainer().offsetParent && ownerDocument && ownerDocument.hasFocus()) {
			this._editor.focus();
			this._editor.getContainer().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	private onCellCollapse(isCollapsed: boolean): void {
		let editorWidget = this._editor.getControl() as ICodeEditor;
		if (isCollapsed) {
			let model = editorWidget.getModel();
			let totalLines = model.getLineCount();
			let endColumn = model.getLineMaxColumn(totalLines);
			editorWidget.setHiddenAreas([{
				startLineNumber: 2,
				startColumn: 1,
				endLineNumber: totalLines,
				endColumn: endColumn
			}]);
		} else {
			editorWidget.setHiddenAreas([]);
		}
		this._editor.setHeightToScrollHeight(false, isCollapsed);
	}
}
