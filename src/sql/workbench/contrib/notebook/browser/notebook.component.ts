/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnDestroy, ViewChildren, QueryList, Input } from '@angular/core';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { INotificationService, INotification } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { MenuId, IMenuService, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IAction, Action, SubmenuAction } from 'vs/base/common/actions';
import { IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import * as DOM from 'vs/base/browser/dom';

import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { CellTypes, CellType, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { ICellModel, INotebookModel, NotebookContentChange } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { INotebookService, INotebookParams, INotebookEditor, INotebookSection, INavigationProvider, ICellEditorProvider, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { Deferred } from 'sql/base/common/promise';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { AddCellAction, KernelsDropdown, AttachToDropdown, TrustedAction, RunAllCellsAction, ClearAllOutputsAction, CollapseCellsAction, RunParametersAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { FileOperationError, FileOperationResult } from 'vs/platform/files/common/files';
import { isValidBasename } from 'vs/base/common/extpath';
import { basename } from 'vs/base/common/resources';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { Button } from 'sql/base/browser/ui/button/button';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { getErrorMessage, onUnexpectedError, createErrorWithActions } from 'vs/base/common/errors';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { IColorTheme } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { CellToolbarComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/cellToolbar.component';
import { MaskedLabeledMenuItemActionItem } from 'sql/platform/actions/browser/menuEntryActionViewItem';
import { IActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';

export const NOTEBOOK_SELECTOR: string = 'notebook-component';

@Component({
	selector: NOTEBOOK_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebook.component.html'))
})
export class NotebookComponent extends AngularDisposable implements OnInit, OnDestroy, INotebookEditor {
	@ViewChild('toolbar', { read: ElementRef }) private toolbar: ElementRef;
	@ViewChild('container', { read: ElementRef }) private container: ElementRef;
	@ViewChild('bookNav', { read: ElementRef }) private bookNav: ElementRef;

	@ViewChildren(CodeCellComponent) private codeCells: QueryList<CodeCellComponent>;
	@ViewChildren(TextCellComponent) private textCells: QueryList<TextCellComponent>;
	@ViewChildren(CellToolbarComponent) private cellToolbar: QueryList<CellToolbarComponent>;

	@Input() _model: NotebookModel;

	protected _actionBar: Taskbar;
	protected isLoading: boolean;
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private _trustedAction: TrustedAction;
	private _runAllCellsAction: RunAllCellsAction;
	private _providerRelatedActions: IAction[] = [];
	private _scrollTop: number;
	private _navProvider: INavigationProvider;
	private navigationResult: nb.NavigationResult;
	public previewFeaturesEnabled: boolean = false;
	public doubleClickEditEnabled: boolean;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
		@Inject(IEditorService) private editorService: IEditorService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IConnectionDialogService) private connectionDialogService: IConnectionDialogService,
		@Inject(IContextKeyService) private contextKeyService: IContextKeyService,
		@Inject(IMenuService) private menuService: IMenuService,
		@Inject(IKeybindingService) private keybindingService: IKeybindingService,
		@Inject(ICapabilitiesService) private capabilitiesService: ICapabilitiesService,
		@Inject(ITextFileService) private textFileService: ITextFileService,
		@Inject(ILogService) private readonly logService: ILogService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService
	) {
		super();
		this.isLoading = true;
		this.doubleClickEditEnabled = this._configurationService.getValue('notebook.enableDoubleClickEdit');
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			this.doubleClickEditEnabled = this._configurationService.getValue('notebook.enableDoubleClickEdit');
		}));
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.initActionBar();
		this.setScrollPosition();

		this.doLoad().catch(e => onUnexpectedError(e));
		this.initNavSection();
	}

	override ngOnDestroy() {
		this.dispose();
		if (this.notebookService) {
			this.notebookService.removeNotebookEditor(this);
		}
	}
	public get model(): NotebookModel | null {
		return this._model;
	}

	public get activeCellId(): string {
		return this._model && this._model.activeCell ? this._model.activeCell.id : '';
	}

	public get cells(): ICellModel[] {
		return this._model ? this._model.cells : [];
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

	public deltaDecorations(newDecorationsRange: NotebookRange | NotebookRange[], oldDecorationsRange: NotebookRange | NotebookRange[]): void {
		if (oldDecorationsRange) {
			if (Array.isArray(oldDecorationsRange)) {
				let decoratedCells: string[] = [];
				oldDecorationsRange.forEach(oldDecorationRange => {
					if (oldDecorationRange.cell.cellType === 'markdown' && decoratedCells.indexOf(oldDecorationRange.cell.cellGuid) === -1) {
						let cell = this.cellEditors.filter(c => c.cellGuid() === oldDecorationRange.cell.cellGuid);
						cell[cell.length - 1].deltaDecorations(undefined, [oldDecorationRange]);
						decoratedCells.push(...oldDecorationRange.cell.cellGuid);
					}
				});
			} else {
				if (oldDecorationsRange.cell.cellType === 'markdown') {
					let cell = this.cellEditors.filter(c => c.cellGuid() === oldDecorationsRange.cell.cellGuid);
					cell[cell.length - 1].deltaDecorations(undefined, oldDecorationsRange);
				}
			}
		}
		if (newDecorationsRange) {
			if (Array.isArray(newDecorationsRange)) {
				let decoratedCells: string[] = [];
				newDecorationsRange.forEach(newDecorationRange => {
					if (newDecorationRange.cell.cellType === 'markdown' && decoratedCells.indexOf(newDecorationRange.cell.cellGuid) === -1) {
						let cell = this.cellEditors.filter(c => c.cellGuid() === newDecorationRange.cell.cellGuid);
						cell[cell.length - 1].deltaDecorations([newDecorationRange], undefined);
						decoratedCells.push(...newDecorationRange.cell.cellGuid);
					}
				});
			} else {
				if (newDecorationsRange.cell.cellType === 'markdown') {
					let cell = this.cellEditors.filter(c => c.cellGuid() === newDecorationsRange.cell.cellGuid);
					cell[cell.length - 1].deltaDecorations(newDecorationsRange, undefined);
				}
			}
		}
	}

	public get addCodeLabel(): string {
		return localize('addCodeLabel', "Add code");
	}

	public get addTextLabel(): string {
		return localize('addTextLabel', "Add text");
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbar.nativeElement;
		toolbarEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
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

	//Saves scrollTop value on scroll change
	public scrollHandler(event: Event) {
		this._scrollTop = (<HTMLElement>event.srcElement).scrollTop;
	}

	public unselectActiveCell() {
		this.model.updateActiveCell(undefined);
		this.detectChanges();
	}

	// Handles double click to edit icon change
	// See textcell.component.ts for changing edit behavior
	public enableActiveCellIconOnDoubleClick() {
		if (this.doubleClickEditEnabled) {
			const toolbarComponent = (<CellToolbarComponent>this.cellToolbar.first);
			const toolbarEditCellAction = toolbarComponent.getEditCellAction();
			if (!toolbarEditCellAction.editMode) {
				toolbarEditCellAction.editMode = !toolbarEditCellAction.editMode;
			}
		}
	}

	// Add cell based on cell type
	public addCell(cellType: CellType, index?: number, event?: Event) {
		if (event) {
			event.stopPropagation();
		}
		this._model.addCell(cellType, index);
	}

	public onKeyDown(event) {
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				let nextIndex = (this.findCellIndex(this.model.activeCell) + 1) % this.cells.length;
				this.selectCell(this.cells[nextIndex]);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				let index = this.findCellIndex(this.model.activeCell);
				if (index === 0) {
					index = this.cells.length;
				}
				this.selectCell(this.cells[--index]);
				break;
			default:
				break;
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

	private async doLoad(): Promise<void> {
		try {
			await this.registerModel();
			this._modelReadyDeferred.resolve(this._model);
			this.notebookService.addNotebookEditor(this);
			await this._model.onClientSessionReady;
			this.detectChanges();
		} catch (error) {
			if (error) {
				// Offer to create a file from the error if we have a file not found and the name is valid
				if ((<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_NOT_FOUND && isValidBasename(basename(this.notebookParams.notebookUri))) {
					let errorWithAction = createErrorWithActions(toErrorMessage(error), {
						actions: [
							new Action('workbench.files.action.createMissingFile', localize('createFile', "Create File"), undefined, true, () => {
								let operations = new Array(1);
								operations[0] = {
									resource: this.notebookParams.notebookUri,
									value: undefined,
									options: undefined
								};
								return this.textFileService.create(operations).then(() => this.editorService.openEditor({
									resource: this.notebookParams.notebookUri,
									options: {
										pinned: true // new file gets pinned by default
									}
								}));
							})
						]
					});
					this.notificationService.error(errorWithAction);

					let editors = this.editorService.visibleEditorPanes;
					for (let editor of editors) {
						if (editor && editor.input.resource === this._notebookParams.input.notebookUri) {
							await editor.group.closeEditor(this._notebookParams.input as NotebookInput, { preserveFocus: true }); // sketchy
							break;
						}
					}
				} else {
					this.setViewInErrorState(localize('displayFailed', "Could not display contents: {0}", getErrorMessage(error)));
					this.setLoading(false);
					this._modelReadyDeferred.reject(error);
					this.notebookService.addNotebookEditor(this);
				}
			}
		}
	}

	private setLoading(isLoading: boolean): void {
		this.isLoading = isLoading;
		this.detectChanges();
	}

	private async registerModel(): Promise<void> {
		this._register(this._model.onError((errInfo: INotification) => this.handleModelError(errInfo)));
		this._register(this._model.contentChanged((change) => this.handleContentChanged(change)));
		this._register(this._model.onProviderIdChange((provider) => this.handleProviderIdChanged(provider)));
		this._register(this._model.kernelChanged((kernelArgs) => this.handleKernelChanged(kernelArgs)));
		this._register(this._model.onCellTypeChanged(() => this.detectChanges()));
		this._register(this._model.layoutChanged(() => this.detectChanges()));

		this.setLoading(false);
		// Check if URI fragment is present; if it is, navigate to section by default
		this.navigateToSectionIfURIFragmentExists();
		this.updateToolbarComponents();
		this.detectChanges();
	}

	private updateToolbarComponents() {
		this._trustedAction.enabled = true;
		if (this.model.trustedMode) {
			this._trustedAction.trusted = true;
		}
	}

	private handleModelError(notification: INotification): void {
		this.notificationService.notify(notification);
	}

	private handleContentChanged(change: NotebookContentChange) {
		if (change.changeType === NotebookChangeType.TrustChanged) {
			this._trustedAction.trusted = this._model.trustedMode;
		}

		// Note: for now we just need to set dirty state and refresh the UI.
		this.detectChanges();
	}

	private handleProviderIdChanged(providerId: string) {
		// If there are any actions that were related to the previous provider,
		// disable them in the actionBar
		this._providerRelatedActions.forEach(action => {
			action.enabled = false;
		});
		this.setContextKeyServiceWithProviderId(providerId);
		this.fillInActionsForCurrentContext();
	}

	private handleKernelChanged(kernelArgs: nb.IKernelChangedArgs) {
		this.fillInActionsForCurrentContext();
	}

	findCellIndex(cellModel: ICellModel): number {
		return this._model.cells.findIndex((cell) => cell.id === cellModel.id);
	}

	private setViewInErrorState(error: any): any {
		// For now, send message as error notification #870 covers having dedicated area for this
		this.notificationService.error(error);
	}

	protected initActionBar(): void {
		this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');

		if (this.previewFeaturesEnabled) {
			let kernelContainer = document.createElement('li');
			let kernelDropdown = this.instantiationService.createInstance(KernelsDropdown, kernelContainer, this.contextViewService, this.modelReady);
			kernelDropdown.render(kernelContainer);
			attachSelectBoxStyler(kernelDropdown, this.themeService);

			let attachToContainer = document.createElement('li');
			let attachToDropdown = new AttachToDropdown(attachToContainer, this.contextViewService, this.modelReady,
				this.connectionManagementService, this.connectionDialogService, this.notificationService, this.capabilitiesService, this._configurationService);
			attachToDropdown.render(attachToContainer);
			attachSelectBoxStyler(attachToDropdown, this.themeService);

			let spacerElement = document.createElement('li');
			spacerElement.style.marginLeft = 'auto';

			let addCellsButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddCodeCell', localize('codeCellsPreview', "Add cell"), 'masked-pseudo code');

			let addCodeCellButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddCodeCell', localize('codePreview', "Code cell"), 'masked-pseudo code');
			addCodeCellButton.cellType = CellTypes.Code;

			let addTextCellButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddTextCell', localize('textPreview', "Text cell"), 'masked-pseudo markdown');
			addTextCellButton.cellType = CellTypes.Markdown;

			this._runAllCellsAction = this.instantiationService.createInstance(RunAllCellsAction, 'notebook.runAllCells', localize('runAllPreview', "Run all"), 'masked-pseudo start-outline');

			let collapseCellsAction = this.instantiationService.createInstance(CollapseCellsAction, 'notebook.collapseCells', true);

			let clearResultsButton = this.instantiationService.createInstance(ClearAllOutputsAction, 'notebook.ClearAllOutputs', true);

			this._trustedAction = this.instantiationService.createInstance(TrustedAction, 'notebook.Trusted', true);
			this._trustedAction.enabled = false;

			let runParametersAction = this.instantiationService.createInstance(RunParametersAction, 'notebook.runParameters', true, this._notebookParams.notebookUri);

			let taskbar = <HTMLElement>this.toolbar.nativeElement;
			this._actionBar = new Taskbar(taskbar, { actionViewItemProvider: action => this.actionItemProvider(action as Action) });
			this._actionBar.context = this._notebookParams.notebookUri;
			taskbar.classList.add('in-preview');

			let buttonDropdownContainer = DOM.$('li.action-item');
			buttonDropdownContainer.setAttribute('role', 'presentation');
			let dropdownMenuActionViewItem = new DropdownMenuActionViewItem(
				addCellsButton,
				[addCodeCellButton, addTextCellButton],
				this.contextMenuService,
				undefined,
				this._actionBar.actionRunner,
				undefined,
				'codicon masked-pseudo masked-pseudo-after add-new dropdown-arrow',
				localize('addCell', "Cell"),
				undefined
			);
			dropdownMenuActionViewItem.render(buttonDropdownContainer);
			dropdownMenuActionViewItem.setActionContext(this._notebookParams.notebookUri);

			this._actionBar.setContent([
				{ element: buttonDropdownContainer },
				{ action: this._runAllCellsAction },
				{ element: Taskbar.createTaskbarSeparator() },
				{ element: kernelContainer },
				{ element: attachToContainer },
				{ element: spacerElement },
				{ action: collapseCellsAction },
				{ action: clearResultsButton },
				{ action: this._trustedAction },
				{ action: runParametersAction },
			]);
		} else {
			let kernelContainer = document.createElement('div');
			let kernelDropdown = this.instantiationService.createInstance(KernelsDropdown, kernelContainer, this.contextViewService, this.modelReady);
			kernelDropdown.render(kernelContainer);
			attachSelectBoxStyler(kernelDropdown, this.themeService);

			let attachToContainer = document.createElement('div');
			let attachToDropdown = new AttachToDropdown(attachToContainer, this.contextViewService, this.modelReady,
				this.connectionManagementService, this.connectionDialogService, this.notificationService, this.capabilitiesService, this._configurationService);
			attachToDropdown.render(attachToContainer);
			attachSelectBoxStyler(attachToDropdown, this.themeService);

			let addCodeCellButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddCodeCell', localize('code', "Code"), 'icon-add');
			addCodeCellButton.cellType = CellTypes.Code;

			let addTextCellButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddTextCell', localize('text', "Text"), 'icon-add');
			addTextCellButton.cellType = CellTypes.Markdown;

			this._runAllCellsAction = this.instantiationService.createInstance(RunAllCellsAction, 'notebook.runAllCells', localize('runAll', "Run Cells"), 'icon-run-cells');

			let clearResultsButton = this.instantiationService.createInstance(ClearAllOutputsAction, 'notebook.ClearAllOutputs', false);

			this._trustedAction = this.instantiationService.createInstance(TrustedAction, 'notebook.Trusted', false);
			this._trustedAction.enabled = false;

			let collapseCellsAction = this.instantiationService.createInstance(CollapseCellsAction, 'notebook.collapseCells', false);

			let taskbar = <HTMLElement>this.toolbar.nativeElement;
			this._actionBar = new Taskbar(taskbar, { actionViewItemProvider: action => this.actionItemProvider(action as Action) });
			this._actionBar.context = this._notebookParams.notebookUri;

			this._actionBar.setContent([
				{ action: addCodeCellButton },
				{ action: addTextCellButton },
				{ element: kernelContainer },
				{ element: attachToContainer },
				{ action: this._trustedAction },
				{ action: this._runAllCellsAction },
				{ action: clearResultsButton },
				{ action: collapseCellsAction },
			]);
		}
	}

	protected initNavSection(): void {
		this._navProvider = this.notebookService.getNavigationProvider(this._notebookParams.notebookUri);

		if (this.contextKeyService.getContextKeyValue('bookOpened') && this._navProvider) {
			this._navProvider.getNavigation(this._notebookParams.notebookUri).then(result => {
				this.navigationResult = result;
				this.addButton(localize('previousButtonLabel', "< Previous"),
					() => this.previousPage(), this.navigationResult.previous ? true : false);
				this.addButton(localize('nextButtonLabel', "Next >"),
					() => this.nextPage(), this.navigationResult.next ? true : false);
				this.detectChanges();
			}, err => {
				this.logService.info(err);
			});
		}
	}

	public get navigationVisibility(): 'hidden' | 'visible' {
		if (this.navigationResult) {
			return this.navigationResult.hasNavigation ? 'visible' : 'hidden';
		}
		return 'hidden';
	}

	private addButton(label: string, onDidClick?: () => void, enabled?: boolean): void {
		const container = DOM.append(this.bookNav.nativeElement, DOM.$('.dialog-message-button'));
		let button = new Button(container);
		button.label = label;
		if (onDidClick) {
			this._register(button.onDidClick(onDidClick));
		}
		if (!enabled) {
			button.enabled = false;
		}
	}

	private actionItemProvider(action: Action): IActionViewItem {
		// Check extensions to create ActionItem; otherwise, return undefined
		// This is similar behavior that exists in MenuItemActionItem
		if (action instanceof MenuItemAction) {

			if ((action.item.id.includes('jupyter.cmd') && this.previewFeaturesEnabled) || action.item.id.includes('mssql')) {
				action.tooltip = action.label;
				action.label = '';
			}
			return new MaskedLabeledMenuItemActionItem(action, this.keybindingService, this.notificationService);
		}
		return undefined;
	}

	/**
	 * Get all of the menu contributions that use the ID 'notebook/toolbar'.
	 * Then, find all groups (currently we don't leverage the contributed
	 * groups functionality for the notebook toolbar), and fill in the 'primary'
	 * array with items that don't list a group. Finally, add any actions from
	 * the primary array to the end of the toolbar.
	 */
	private fillInActionsForCurrentContext(): void {
		let primary: IAction[] = [];
		let secondary: IAction[] = [];
		let notebookBarMenu = this.menuService.createMenu(MenuId.NotebookToolbar, this.contextKeyService);
		let groups = notebookBarMenu.getActions({ arg: null, shouldForwardArgs: true });
		fillInActions(groups, { primary, secondary }, false, '', Number.MAX_SAFE_INTEGER, (action: SubmenuAction, group: string, groupSize: number) => group === undefined || group === '');
		this.addPrimaryContributedActions(primary);
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	private addPrimaryContributedActions(primary: IAction[]) {
		for (let action of primary) {
			// Need to ensure that we don't add the same action multiple times
			let foundIndex = this._providerRelatedActions.findIndex(act => act.id === action.id);
			if (foundIndex < 0) {
				this._actionBar.addAction(action);
				this._providerRelatedActions.push(action);
			} else {
				this._providerRelatedActions[foundIndex].enabled = true;
			}
		}
	}

	private setContextKeyServiceWithProviderId(providerId: string) {
		let provider = new RawContextKey<string>('providerId', providerId);
		provider.bindTo(this.contextKeyService);
	}

	public get notebookParams(): INotebookParams {
		return this._notebookParams;
	}

	public get id(): string {
		return this._notebookParams.notebookUri.toString();
	}

	public get modelReady(): Promise<INotebookModel> {
		return this._modelReadyDeferred.promise;
	}

	isActive(): boolean {
		return this.editorService.activeEditor ? this.editorService.activeEditor.matches(this.notebookParams.input) : false;
	}

	isVisible(): boolean {
		let notebookEditor = this.notebookParams.input;
		return this.editorService.visibleEditors.some(e => e.matches(notebookEditor));
	}

	isDirty(): boolean {
		return this.notebookParams.input.isDirty();
	}

	executeEdits(edits: ISingleNotebookEditOperation[]): boolean {
		if (!edits || edits.length === 0) {
			return false;
		}
		this._model.pushEditOperations(edits);
		return true;
	}

	public async runCell(cell: ICellModel): Promise<boolean> {
		await this.modelReady;
		let uriString = cell.cellUri.toString();
		if (this._model.cells.findIndex(c => c.cellUri.toString() === uriString) > -1) {
			this.selectCell(cell);
			return cell.runCell(this.notificationService, this.connectionManagementService);
		} else {
			return Promise.reject(new Error(localize('cellNotFound', "cell with URI {0} was not found in this model", uriString)));
		}
	}

	public async runAllCells(startCell?: ICellModel, endCell?: ICellModel): Promise<boolean> {
		await this.modelReady;
		let codeCells = this._model.cells.filter(cell => cell.cellType === CellTypes.Code);
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
			for (let i = startIndex; i < endIndex; i++) {
				let cellStatus = await this.runCell(codeCells[i]);
				if (!cellStatus) {
					return Promise.reject(new Error(localize('cellRunFailed', "Run Cells failed - See error in output of the currently selected cell for more information.")));
				}
			}
		}
		return true;
	}

	public async clearOutput(cell: ICellModel): Promise<boolean> {
		try {
			await this.modelReady;
			let uriString = cell.cellUri.toString();
			if (this._model.cells.findIndex(c => c.cellUri.toString() === uriString) > -1) {
				this.selectCell(cell);
				// Clear outputs of the requested cell if cell type is code cell.
				// If cell is markdown cell, clearOutputs() is a no-op
				if (cell.cellType === CellTypes.Code) {
					(cell as CellModel).clearOutputs();
				}
				return true;
			} else {
				return Promise.reject(new Error(localize('cellNotFound', "cell with URI {0} was not found in this model", uriString)));
			}
		} catch (e) {
			return Promise.reject(e);
		}
	}

	public async clearAllOutputs(): Promise<boolean> {
		try {
			await this.modelReady;
			this._model.cells.forEach(cell => {
				if (cell.cellType === CellTypes.Code) {
					(cell as CellModel).clearOutputs();
				}
			});
			return Promise.resolve(true);
		}
		catch (e) {
			return Promise.reject(e);
		}
	}

	public async nextPage(): Promise<void> {
		try {
			if (this._navProvider) {
				this._navProvider.onNext(this.model.notebookUri);
			}
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
		}
	}

	public previousPage() {
		try {
			if (this._navProvider) {
				this._navProvider.onPrevious(this.model.notebookUri);
			}
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
		}
	}

	getSections(): INotebookSection[] {
		return this.getSectionElements();
	}

	private getSectionElements(): NotebookSection[] {
		let headers: NotebookSection[] = [];
		let el: HTMLElement = this.container.nativeElement;
		let headerElements = el.querySelectorAll('h1, h2, h3, h4, h5, h6, a[name], a[id]');
		for (let i = 0; i < headerElements.length; i++) {
			let headerEl = headerElements[i] as HTMLElement;
			if (headerEl['id'] || headerEl['name']) {
				headers.push(new NotebookSection(headerEl));
			}
		}
		return headers;
	}

	private navigateToSectionIfURIFragmentExists(): void {
		if (this.notebookParams.notebookUri?.fragment) {
			this.navigateToSection(this.notebookParams.notebookUri.fragment);
		}
	}

	navigateToSection(id: string): void {
		let section = this.getSectionElements().find(s => s.relativeUri && s.relativeUri.toLowerCase() === id.toLowerCase());
		if (section) {
			section.headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
			section.headerEl.focus();
		}
	}
}

class NotebookSection implements INotebookSection {

	constructor(public headerEl: HTMLElement) {
	}

	get relativeUri(): string {
		return this.headerEl['id'] || this.headerEl['name'];
	}

	get header(): string {
		return this.headerEl.textContent;
	}
}
