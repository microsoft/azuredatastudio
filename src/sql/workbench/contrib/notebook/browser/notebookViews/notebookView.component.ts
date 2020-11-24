/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//import 'vs/css!./placeholder';

import { Component, Input, ViewChildren, QueryList, ChangeDetectorRef, forwardRef, Inject, ViewChild, ElementRef, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { ICellModel, INotebookModel, ISingleNotebookEditOperation } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { ICellEditorProvider, INotebookParams, INotebookService, INotebookEditor, NotebookRange, INotebookSection, DEFAULT_NOTEBOOK_PROVIDER, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import * as notebookUtils from 'sql/workbench/services/notebook/browser/models/notebookUtils';
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
import { onUnexpectedError } from 'vs/base/common/errors';
import { localize } from 'vs/nls';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import * as DOM from 'vs/base/browser/dom';
import { Deferred } from 'sql/base/common/promise';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { DeleteViewAction, InsertCellAction, ViewSettingsAction } from 'sql/workbench/contrib/notebook/browser/notebookViews/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CellType, CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import * as _ from 'lodash';
import { find, firstIndex } from 'vs/base/common/arrays';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { NotebookViewsGridComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewGrid.component';
import { INotebookView } from 'sql/workbench/services/notebook/browser/models/notebookViewModel';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/models/notebookViewsExtension';

export const PLACEHOLDER_SELECTOR: string = 'notebook-view-component';

@Component({
	selector: PLACEHOLDER_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookView.component.html'))
})

export class NotebookViewComponent extends AngularDisposable implements INotebookEditor {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() extension: NotebookViewsExtension;

	@ViewChild('container', { read: ElementRef }) private container: ElementRef;
	@ViewChild('viewsToolbar', { read: ElementRef }) private viewsToolbar: ElementRef;
	@ViewChild(NotebookViewsGridComponent) private gridstack: NotebookViewsGridComponent;
	@ViewChildren(CodeCellComponent) private codeCells: QueryList<CodeCellComponent>;
	@ViewChildren(TextCellComponent) private textCells: QueryList<TextCellComponent>;

	protected _actionBar: Taskbar;
	public previewFeaturesEnabled: boolean = false;
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private _runAllCellsAction: RunAllCellsAction;

	private _scrollTop: number;

	constructor(
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IKeybindingService) private keybindingService: IKeybindingService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
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
	async runCell(cell: ICellModel): Promise<boolean> {
		await this.modelReady;
		let uriString = cell.cellUri.toString();
		if (firstIndex(this.model.cells, c => c.cellUri.toString() === uriString) > -1) {
			this.selectCell(cell);
			return cell.runCell(this.notificationService, this.connectionManagementService);
		} else {
			return Promise.reject(new Error(localize('cellNotFound', "cell with URI {0} was not found in this model", uriString)));
		}
	}

	public async runAllCells(startCell?: ICellModel, endCell?: ICellModel): Promise<boolean> {
		await this.modelReady;
		let codeCells = this.model.cells.filter(cell => cell.cellType === CellTypes.Code);
		if (codeCells && codeCells.length) {
			// For the run all cells scenario where neither startId not endId are provided, set defaults
			let startIndex = 0;
			let endIndex = codeCells.length;
			if (!isUndefinedOrNull(startCell)) {
				startIndex = firstIndex(codeCells, c => c.id === startCell.id);
			}
			if (!isUndefinedOrNull(endCell)) {
				endIndex = firstIndex(codeCells, c => c.id === endCell.id);
			}
			for (let i = startIndex; i < endIndex; i++) {
				let cellStatus = await this.runCell(codeCells[i]);
				if (!cellStatus) {
					return Promise.reject(new Error(localize('cellRunFailed', "Run Cells failed - See error in output of the currently selected cell for more information.")));
				}
			}
		}
		return true;
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
	insertCell(cell: ICellModel) {
		this.gridstack.onCellChanged({ cell: cell, event: 'insert' });
	}

	ngOnInit() {
		this.initViewsToolbar();
		this.notebookService.addNotebookEditor(this);
		this._modelReadyDeferred.resolve(this.model);
		this.setScrollPosition();

		this.doLoad().catch(e => onUnexpectedError(e));
	}

	ngOnDestroy() {
		this.dispose();
		if (this.notebookService) {
			//this.notebookService.removeNotebookEditor(this);
		}
	}

	ngOnChanges() {
		this.initViewsToolbar();
	}

	private async doLoad(): Promise<void> {
		await this.awaitNonDefaultProvider();
		await this.model.requestModelLoad();
		await this.model.onClientSessionReady;
		this.detectChanges();
	}

	private async awaitNonDefaultProvider(): Promise<void> {
		// Wait on registration for now. Long-term would be good to cache and refresh
		await this.notebookService.registrationComplete;
		this.model.standardKernels = this._notebookParams.input.standardKernels;
		// Refresh the provider if we had been using default
		let providerInfo = await this._notebookParams.providerInfo;

		if (DEFAULT_NOTEBOOK_PROVIDER === providerInfo.providerId) {
			let providers = notebookUtils.getProvidersForFileName(this._notebookParams.notebookUri.fsPath, this.notebookService);
			let tsqlProvider = find(providers, provider => provider === SQL_NOTEBOOK_PROVIDER);
			providerInfo.providerId = tsqlProvider ? SQL_NOTEBOOK_PROVIDER : providers[0];
		}
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

	private setScrollPosition(): void {
		if (this._notebookParams && this._notebookParams.input) {
			this._register(this._notebookParams.input.layoutChanged(() => {
				let containerElement = <HTMLElement>this.container.nativeElement;
				containerElement.scrollTop = this._scrollTop;
			}));
		}
	}

	//Saves scrollTop value on scroll change
	public scrollHandler(event: Event) {
		this._scrollTop = (<HTMLElement>event.srcElement).scrollTop;
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

		let insertCellsAction = this.instantiationService.createInstance(InsertCellAction, this.insertCell.bind(this), this.extension, this._containerRef, this._componentFactoryResolver);

		this._runAllCellsAction = this.instantiationService.createInstance(RunAllCellsAction, 'notebook.runAllCells', localize('runAllPreview', "Run all"), 'notebook-button masked-pseudo start-outline');

		let spacerElement = document.createElement('li');
		spacerElement.style.marginLeft = 'auto';

		let viewOptions = this.instantiationService.createInstance(ViewSettingsAction, this.extension);

		let viewsContainer = document.createElement('li');
		let viewsActionsProvider = new NotebookViewsDropdownSelectionProvider(viewsContainer, this.contextViewService, this.modelReady, this.notebookService, this.instantiationService);
		let viewsButton = this.instantiationService.createInstance(AddCellAction, 'notebook.OpenViews', undefined, 'notebook-button masked-pseudo code');
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
			this.activeView?.name,
			() => AnchorAlignment.RIGHT
		);
		viewsDropdownMenuActionViewItem.render(viewsDropdownContainer);
		viewsDropdownMenuActionViewItem.setActionContext(this._notebookParams.notebookUri);

		let deleteView = this.instantiationService.createInstance(DeleteViewAction, this.extension);

		this._actionBar.setContent([
			{ element: titleElement },
			{ element: Taskbar.createTaskbarSeparator() },
			{ action: insertCellsAction },
			{ action: this._runAllCellsAction },
			{ element: spacerElement },
			{ element: viewsDropdownContainer },
			{ action: viewOptions },
			{ action: deleteView }
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
