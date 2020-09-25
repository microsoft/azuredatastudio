/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//import 'vs/css!./placeholder';

import { Component, Input, ViewChildren, QueryList, ChangeDetectorRef, forwardRef, Inject, ViewChild, ElementRef, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { ICellModel, INotebookModel, ISingleNotebookEditOperation } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { ICellEditorProvider, INotebookParams, INotebookService, INotebookEditor, NotebookRange, INotebookSection } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Action, IActionViewItem } from 'vs/base/common/actions';
import { LabeledMenuItemActionItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { NotebookViewsOptions as NotebookViewsDropdownSelectionProvider, AddCellAction, RunAllCellsAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { MenuItemAction } from 'vs/platform/actions/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { NotebookViewExtension, INotebookView } from 'sql/workbench/services/notebook/browser/models/notebookView';
import { localize } from 'vs/nls';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import * as DOM from 'vs/base/browser/dom';
import { Deferred } from 'sql/base/common/promise';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { InsertCellAction, ViewSettingsAction } from 'sql/workbench/contrib/notebook/browser/notebookViews/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CellType } from 'sql/workbench/services/notebook/common/contracts';
import * as _ from 'lodash';

export const PLACEHOLDER_SELECTOR: string = 'notebook-view-component';

@Component({
	selector: PLACEHOLDER_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookView.component.html'))
})

export class NotebookViewComponent extends AngularDisposable implements INotebookEditor {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;

	@ViewChild('viewsToolbar', { read: ElementRef }) private viewsToolbar: ElementRef;
	@ViewChildren(CodeCellComponent) private codeCells: QueryList<CodeCellComponent>;
	@ViewChildren(TextCellComponent) private textCells: QueryList<TextCellComponent>;

	protected _actionBar: Taskbar;
	public previewFeaturesEnabled: boolean = false;
	protected _extension: NotebookViewExtension;
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private _runAllCellsAction: RunAllCellsAction;
	private _prevModel: NotebookModel;

	constructor(
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IKeybindingService) private keybindingService: IKeybindingService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(IEditorService) private _editorService: IEditorService,
		@Inject(ViewContainerRef) private _containerRef: ViewContainerRef,
		@Inject(ComponentFactoryResolver) private _componentFactoryResolver: ComponentFactoryResolver,
	) {
		super();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
		}));
	}

	ngDoCheck() {
		// check for object mutation
		if (this._extension) {
			if (!_.isEqual(this._prevModel, this.model)) {
				this._changeRef.detectChanges();
			}
		}
	}

	public get notebookParams(): INotebookParams {
		return this._notebookParams;
	}

	public get id(): string {
		return this.notebookParams.notebookUri.toString();
	}

	isDirty(): boolean {
		return this.notebookParams.input.isDirty();
	}
	isActive(): boolean {
		return this._editorService.activeEditor ? this._editorService.activeEditor.matches(this.notebookParams.input) : false;
	}
	isVisible(): boolean {
		let notebookEditor = this.notebookParams.input;
		return this._editorService.visibleEditors.some(e => e.matches(notebookEditor));
	}
	executeEdits(edits: ISingleNotebookEditOperation[]): boolean {
		throw new Error('Method not implemented.');
	}
	runCell(cell: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	runAllCells(startCell?: ICellModel, endCell?: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	clearOutput(cell: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	clearAllOutputs(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	getSections(): INotebookSection[] {
		throw new Error('Method not implemented.');
	}
	navigateToSection(sectionId: string): void {
		throw new Error('Method not implemented.');
	}
	deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		throw new Error('Method not implemented.');
	}
	addCell(cellType: CellType, index?: number, event?: UIEvent) {
		throw new Error('Method not implemented.');
	}

	ngOnInit() {
		this.initExtension();
		this.initViewsToolbar();
		this._modelReadyDeferred.resolve(this.model);
		this.notebookService.addNotebookEditor(this);
	}

	ngOnDestroy() {
		this.dispose();
		if (this.notebookService) {
			this.notebookService.removeNotebookEditor(this);
		}
	}

	ngOnChanges() {
		this._prevModel = this.model;

		this.initViewsToolbar();
	}

	initExtension() {
		this._extension = new NotebookViewExtension(this.model);
	}

	public get extension(): NotebookViewExtension {
		return this._extension;
	}

	public get cells(): ICellModel[] {
		return this.model ? this.model.cells : [];
	}

	public selectCell(cell: ICellModel, event?: Event) {
		if (event) {
			event.stopPropagation();
		}
		if (!this.model.activeCell || this.model.activeCell.id !== cell.id) {
			this.model.updateActiveCell(cell);
			this.detectChanges();
		}
	}

	public unselectActiveCell() {
		this.model.updateActiveCell(undefined);
		this.detectChanges();
	}

	protected initViewsToolbar() {
		let taskbar = <HTMLElement>this.viewsToolbar.nativeElement;

		if (!this._actionBar) {
			this._actionBar = new Taskbar(taskbar, { actionViewItemProvider: action => this.actionItemProvider(action as Action) });
			this._actionBar.context = this._notebookParams.notebookUri;//this.model;
			taskbar.classList.add('in-preview');
		}

		let titleElement = document.createElement('li');
		let titleText = document.createElement('span');
		titleText.innerHTML = this.activeView?.name;
		titleElement.appendChild(titleText);
		titleElement.style.marginRight = '25px';
		titleElement.style.minHeight = '25px';

		let addCellsAction = this.instantiationService.createInstance(InsertCellAction, this.extension, this._containerRef, this._componentFactoryResolver);

		this._runAllCellsAction = this.instantiationService.createInstance(RunAllCellsAction, 'notebook.runAllCells', localize('runAllPreview', "Run all"), 'notebook-button masked-pseudo start-outline');

		let spacerElement = document.createElement('li');
		spacerElement.style.marginLeft = 'auto';

		let viewOptions = this.instantiationService.createInstance(ViewSettingsAction, this.extension);

		let viewsContainer = document.createElement('li');
		let viewsActionsProvider = new NotebookViewsDropdownSelectionProvider(viewsContainer, this.contextViewService, this.modelReady, this.notebookService, this.instantiationService);
		let viewsButton = this.instantiationService.createInstance(AddCellAction, 'notebook.OpenViews', localize('views', "Views"), 'notebook-button masked-pseudo code');
		let viewsDropdownContainer = DOM.$('li.action-item');
		viewsDropdownContainer.setAttribute('role', 'presentation');
		let viewsDropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			viewsButton,
			viewsActionsProvider,
			this.contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'codicon notebook-button masked-pseudo masked-pseudo-after icon-dashboard-view dropdown-arrow',
			'',
			() => AnchorAlignment.RIGHT
		);
		viewsDropdownMenuActionViewItem.render(viewsDropdownContainer);
		viewsDropdownMenuActionViewItem.setActionContext(this._notebookParams.notebookUri);
		viewsActionsProvider.onUpdated(() => {
			viewsDropdownMenuActionViewItem.render(viewsDropdownContainer);
		});

		this._actionBar.setContent([
			{ element: titleElement },
			{ element: Taskbar.createTaskbarSeparator() },
			{ action: addCellsAction },
			{ action: this._runAllCellsAction },
			{ element: spacerElement },
			{ element: viewsDropdownContainer },
			{ action: viewOptions }
		]);
	}

	private actionItemProvider(action: Action): IActionViewItem {
		// Check extensions to create ActionItem; otherwise, return undefined
		// This is similar behavior that exists in MenuItemActionItem
		if (action instanceof MenuItemAction) {

			if (action.item.id.includes('jupyter.cmd') && this.previewFeaturesEnabled) {
				action.tooltip = action.label;
				action.label = '';
			}
			return new LabeledMenuItemActionItem(action, this.keybindingService, this.contextMenuService, this.notificationService, 'notebook-button fixed-width');
		}
		return undefined;
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	public get modelReady(): Promise<INotebookModel> {
		return this._modelReadyDeferred.promise;
	}

	public get cellEditors(): ICellEditorProvider[] {
		let editors: ICellEditorProvider[] = [];
		if (this.codeCells) {
			this.codeCells.toArray().forEach(cell => editors.push(...cell.cellEditors));
		}
		if (this.textCells) {
			this.textCells.toArray().forEach(cell => editors.push(...cell.cellEditors));
			editors.push(...this.textCells.toArray());
		}
		return editors;
	}
}
