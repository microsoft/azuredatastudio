/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Input, ViewChildren, QueryList, ChangeDetectorRef, forwardRef, Inject, ViewChild, ElementRef, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { ICellModel, INotebookModel, ISingleNotebookEditOperation, NotebookContentChange } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import 'vs/css!./notebookViewsGrid';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { ICellEditorProvider, INotebookParams, INotebookService, INotebookEditor, NotebookRange, INotebookSection, DEFAULT_NOTEBOOK_PROVIDER, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import * as notebookUtils from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { Action } from 'vs/base/common/actions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { MenuItemAction } from 'vs/platform/actions/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { onUnexpectedError } from 'vs/base/common/errors';
import { localize } from 'vs/nls';
import { Deferred } from 'sql/base/common/promise';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CellType, CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { INotebookView, INotebookViewMetadata } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { NotebookViewsGridComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsGrid.component';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DeleteViewAction, InsertCellAction, ViewSettingsAction } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsActions';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { NotebookViewsActionProvider, AddCellAction, RunAllCellsAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import * as DOM from 'vs/base/browser/dom';
import { AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import { LabeledMenuItemActionItem } from 'sql/platform/actions/browser/menuEntryActionViewItem';
import { IActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';

export const NOTEBOOKVIEWS_SELECTOR: string = 'notebook-view-component';

@Component({
	selector: NOTEBOOKVIEWS_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookViews.component.html'))
})

export class NotebookViewComponent extends AngularDisposable implements INotebookEditor {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() views: NotebookViewsExtension;
	@Input() notebookMetadata: INotebookViewMetadata;

	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;
	@ViewChild('viewsToolbar', { read: ElementRef }) private _viewsToolbar: ElementRef;
	@ViewChild(NotebookViewsGridComponent) private _gridstack: NotebookViewsGridComponent;
	@ViewChildren(CodeCellComponent) private _codeCells: QueryList<CodeCellComponent>;
	@ViewChildren(TextCellComponent) private _textCells: QueryList<TextCellComponent>;

	protected _actionBar: Taskbar;
	public previewFeaturesEnabled: boolean = false;
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private _runAllCellsAction: RunAllCellsAction;
	private _scrollTop: number;
	public _cellsAwaitingInput: ICellModel[] = [];
	public readonly cellsAwaitingInputModalTitle: string = localize('cellAwaitingInputTitle', "Cell Awaiting Input");
	public readonly loadingMessage = localize('loading', "Loading");

	constructor(
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IKeybindingService) private _keybindingService: IKeybindingService,
		@Inject(IContextMenuService) private _contextMenuService: IContextMenuService,
		@Inject(INotificationService) private _notificationService: INotificationService,
		@Inject(INotebookService) private _notebookService: INotebookService,
		@Inject(IConnectionManagementService) private _connectionManagementService: IConnectionManagementService,
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
		if (this.model.cells.findIndex(c => c.cellUri.toString() === uriString) > -1) {
			this.selectCell(cell);
			return cell.runCell(this._notificationService, this._connectionManagementService);
		} else {
			throw new Error(localize('cellNotFound', "cell with URI {0} was not found in this model", uriString));
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
				startIndex = codeCells.findIndex(c => c.id === startCell.id);
			}
			if (!isUndefinedOrNull(endCell)) {
				endIndex = codeCells.findIndex(c => c.id === endCell.id);
			}
			let statusNotification = this._notificationService.notify({ severity: Severity.Info, message: localize('startingExecution', "Starting execution"), progress: { total: endIndex + 1, worked: 0 } });
			for (let i = startIndex; i < endIndex; i++) {
				statusNotification.updateMessage(localize('runningCell', "Running cell {0} of {1}", (i + 1), (endIndex)));
				statusNotification.progress.worked(i);
				try {
					await this.runCell(codeCells[i]);
				} catch (error) {
					statusNotification.updateSeverity(Severity.Error);
					statusNotification.updateMessage(localize('cellRunFailed', "Run Cells failed - See error in output of the currently selected cell for more information."));
					return false;
				}
			}
			statusNotification.close();
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
		this._gridstack.onCellChanged({ cell: cell, event: 'insert' });
	}

	ngOnInit() {
		this.initViewsToolbar();
		this._modelReadyDeferred.resolve(this.model);
		this._notebookService.addNotebookEditor(this);
		this.setScrollPosition();

		this._register(this.model.contentChanged((e) => this.handleContentChanged(e)));
		this.doLoad().catch(e => onUnexpectedError(e));
	}

	override ngOnDestroy() {
		this.dispose();
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
		await this._notebookService.registrationComplete;
		this.model.standardKernels = this._notebookParams.input.standardKernels;
		// Refresh the provider if we had been using default
		let providerInfo = await this._notebookParams.providerInfo;

		if (DEFAULT_NOTEBOOK_PROVIDER === providerInfo.providerId) {
			let providers = notebookUtils.getProvidersForFileName(this._notebookParams.notebookUri.fsPath, this._notebookService);
			let tsqlProvider = providers.find(provider => provider === SQL_NOTEBOOK_PROVIDER);
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
				let containerElement = <HTMLElement>this._container.nativeElement;
				containerElement.scrollTop = this._scrollTop;
			}));
		}
	}

	/**
	 * Saves scrollTop value on scroll change
	 */
	public scrollHandler(event: Event) {
		this._scrollTop = (<HTMLElement>event.srcElement).scrollTop;
	}

	public unselectActiveCell() {
		this.model.updateActiveCell(undefined);
		this.detectChanges();
	}

	protected initViewsToolbar() {
		let taskbar = <HTMLElement>this._viewsToolbar.nativeElement;

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

		let insertCellsAction = this._instantiationService.createInstance(InsertCellAction, this.insertCell.bind(this), this.views, this._containerRef, this._componentFactoryResolver);

		// Hide the insert cell action button if no cells can be added
		insertCellsAction.enabled = this.activeView?.hiddenCells.length > 0;
		this.activeView.onCellVisibilityChanged(e => { insertCellsAction.enabled = this.activeView?.hiddenCells.length > 0; });

		this._runAllCellsAction = this._instantiationService.createInstance(RunAllCellsAction, 'notebook.runAllCells', localize('runAllPreview', "Run all"), 'notebook-button masked-pseudo start-outline');

		let spacerElement = document.createElement('li');
		spacerElement.style.marginLeft = 'auto';

		let viewOptions = this._instantiationService.createInstance(ViewSettingsAction, this.views);

		let viewsContainer = document.createElement('li');
		let viewsActionsProvider = new NotebookViewsActionProvider(viewsContainer, this.views, this.modelReady, this._notebookService, this._notificationService, this._instantiationService);
		let viewsButton = this._instantiationService.createInstance(AddCellAction, 'notebook.OpenViews', undefined, 'notebook-button masked-pseudo code');
		let viewsDropdownContainer = DOM.$('li.action-item');
		viewsDropdownContainer.setAttribute('role', 'presentation');
		let viewsDropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			viewsButton,
			viewsActionsProvider,
			this._contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'codicon notebook-button masked-pseudo masked-pseudo-after icon-dashboard-view dropdown-arrow',
			this.activeView?.name,
			() => AnchorAlignment.RIGHT
		);
		viewsDropdownMenuActionViewItem.render(viewsDropdownContainer);
		viewsDropdownMenuActionViewItem.setActionContext(this._notebookParams.notebookUri);

		let deleteView = this._instantiationService.createInstance(DeleteViewAction, this.views);

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
			return new LabeledMenuItemActionItem(action, this._keybindingService, this._notificationService, 'notebook-button fixed-width');
		}
		return undefined;
	}

	private handleContentChanged(change: NotebookContentChange) {
		switch (change.changeType) {
			case NotebookChangeType.CellAwaitingInput: {
				const cell: ICellModel = change?.cells[0];
				this._cellsAwaitingInput.push(cell);
				this.detectChanges();
				break;
			}
			case NotebookChangeType.CellExecuted: {
				const cell: ICellModel = change?.cells[0];
				const indexToRemove = this._cellsAwaitingInput.findIndex(c => c.id === cell.id);
				if (indexToRemove >= 0) {
					this._cellsAwaitingInput.splice(indexToRemove, 1);
					this.model.serializationStateChanged(NotebookChangeType.CellsModified, cell);
					this.detectChanges();
				}
				break;
			}
		}
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
		if (this._codeCells) {
			this._codeCells.toArray().forEach(cell => editors.push(...cell.cellEditors));
		}
		if (this._textCells) {
			this._textCells.toArray().forEach(cell => editors.push(...cell.cellEditors));
			editors.push(...this._textCells.toArray());
		}
		return editors;
	}

	public get cellsAwaitingInput(): ICellModel[] {
		return this._gridstack.hiddenItems.filter(i => this._cellsAwaitingInput.includes(i.cell)).map(i => i.cell);
	}
}
