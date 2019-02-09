/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, Output, EventEmitter, OnChanges, SimpleChange } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/node/lifecycle';
import { QueryTextEditor } from 'sql/parts/modelComponents/queryTextEditor';
import { CellToggleMoreActions } from 'sql/parts/notebook/cellToggleMoreActions';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { RunCellAction, CellContext } from 'sql/parts/notebook/cellViews/codeActions';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { SimpleProgressService } from 'vs/editor/standalone/browser/simpleServices';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import URI from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import * as DOM from 'vs/base/browser/dom';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Emitter, debounceEvent } from 'vs/base/common/event';

export const CODE_SELECTOR: string = 'code-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./code.component.html'))
})
export class CodeComponent extends AngularDisposable implements OnInit, OnChanges {
	@ViewChild('toolbar', { read: ElementRef }) private toolbarElement: ElementRef;
	@ViewChild('moreactions', { read: ElementRef }) private moreActionsElementRef: ElementRef;
	@ViewChild('editor', { read: ElementRef }) private codeElement: ElementRef;
	@Input() cellModel: ICellModel;

	@Output() public onContentChanged = new EventEmitter<void>();

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@Input() set hover(value: boolean) {
		this.cellModel.hover = value;
		if (!this.isActive()) {
			// Only make a change if we're not active, since this has priority
			this.toggleMoreActionsButton(this.cellModel.hover);
		}
	}


	protected _actionBar: Taskbar;
	private readonly _minimumHeight = 30;
	private readonly _maximumHeight = 4000;
	private _editor: QueryTextEditor;
	private _editorInput: UntitledEditorInput;
	private _editorModel: ITextModel;
	private _uri: string;
	private _model: NotebookModel;
	private _activeCellId: string;
	private _cellToggleMoreActions: CellToggleMoreActions;
	private _layoutEmitter = new Emitter<void>();

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService
	) {
		super();
		this._cellToggleMoreActions = this._instantiationService.createInstance(CellToggleMoreActions);
		debounceEvent(this._layoutEmitter.event, (l, e) => e, 250, /*leading=*/false)
		(() => this.layout());

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
				this.toggleMoreActionsButton(isActive);
				if (this._editor) {
					this._editor.toggleEditorSelected(isActive);
				}
				break;
			}
		}
	}

	ngAfterContentInit(): void {
		this.createEditor();
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this._layoutEmitter.fire();
		}));
	}

	ngAfterViewInit(): void {
		this._layoutEmitter.fire();
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private createEditor(): void {
		let instantiationService = this._instantiationService.createChild(new ServiceCollection([IProgressService, new SimpleProgressService()]));
		this._editor = instantiationService.createInstance(QueryTextEditor);
		this._editor.create(this.codeElement.nativeElement);
		this._editor.setVisible(true);
		this._editor.setMinimumHeight(this._minimumHeight);
		this._editor.setMaximumHeight(this._maximumHeight);
		let uri = this.createUri();
		this._editorInput = instantiationService.createInstance(UntitledEditorInput, uri, false, this.cellModel.language, '', '');
		this._editor.setInput(this._editorInput, undefined);
		this.setFocusAndScroll();
		this._editorInput.resolve().then(model => {
			this._editorModel = model.textEditorModel;
			this._modelService.updateModel(this._editorModel, this.cellModel.source);
		});
		let isActive = this.cellModel.id === this._activeCellId;
		this._editor.toggleEditorSelected(isActive);

		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel.onDidChangeContent(e => {
			this._editor.setHeightToScrollHeight();
			this.cellModel.source = this._editorModel.getValue();
			this.onContentChanged.emit();
			// TODO see if there's a better way to handle reassessing size.

			setTimeout(() => this._layoutEmitter.fire(), 250);
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('editor.wordWrap')) {
				this._editor.setHeightToScrollHeight(true);
			}
		}));
		this._register(this.model.layoutChanged(() => this._layoutEmitter.fire, this));
		this.layout();
	}

	public layout(): void {
		this._editor.layout(new DOM.Dimension(
			DOM.getContentWidth(this.codeElement.nativeElement),
			DOM.getContentHeight(this.codeElement.nativeElement)));
		this._editor.setHeightToScrollHeight();
	}

	protected initActionBar() {
		let context = new CellContext(this.model, this.cellModel);
		let runCellAction = this._instantiationService.createInstance(RunCellAction, context);

		let taskbar = <HTMLElement>this.toolbarElement.nativeElement;
		this._actionBar = new Taskbar(taskbar, this.contextMenuService);
		this._actionBar.context = context;
		this._actionBar.setContent([
			{ action: runCellAction }
		]);

		this._cellToggleMoreActions.onInit(this.moreActionsElementRef, this.model, this.cellModel);
	}


	private createUri(): URI {
		let uri = URI.from({ scheme: Schemas.untitled, path: `notebook-editor-${this.cellModel.id}` });
		// Use this to set the internal (immutable) and public (shared with extension) uri properties
		this.cellModel.cellUri = uri;
		return uri;
	}

	/// Editor Functions
	private updateModel() {
		if (this._editorModel) {
			this._modelService.updateModel(this._editorModel, this.cellModel.source);
		}
	}

	private updateLanguageMode() {
		if (this._editorModel && this._editor) {
			this._modeService.getOrCreateMode(this.cellModel.language).then((modeValue) => {
				this._modelService.setMode(this._editorModel, modeValue);
			});
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbarElement.nativeElement;
		toolbarEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();

		let moreActionsEl = <HTMLElement>this.moreActionsElementRef.nativeElement;
		moreActionsEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	private setFocusAndScroll(): void {
		if (this.cellModel.id === this._activeCellId) {
			this._editor.focus();
			this._editor.getContainer().scrollIntoView();
		}
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	protected toggleMoreActionsButton(isActiveOrHovered: boolean) {
		this._cellToggleMoreActions.toggleVisible(!isActiveOrHovered);
	}
}
