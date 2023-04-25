/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { IAction } from 'vs/base/common/actions';
import { disposableTimeout } from 'vs/base/common/async';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { MarshalledId } from 'vs/base/common/marshallingIds';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { createActionViewItem, createAndFillInActionBarActions, MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenu, IMenuService, MenuId, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotebookCellActionContext } from 'vs/workbench/contrib/notebook/browser/controller/coreActions';
import { ICellViewModel, INotebookEditorDelegate } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CodiconActionViewItem } from 'vs/workbench/contrib/notebook/browser/view/cellParts/cellActionView';
import { CellPart } from 'vs/workbench/contrib/notebook/browser/view/cellPart';
import { registerStickyScroll } from 'vs/workbench/contrib/notebook/browser/view/cellParts/stickyScroll';

export class BetweenCellToolbar extends CellPart {
	private _betweenCellToolbar!: ToolBar;

	constructor(
		private readonly _notebookEditor: INotebookEditorDelegate,
		_titleToolbarContainer: HTMLElement,
		private readonly _bottomCellToolbarContainer: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IMenuService menuService: IMenuService
	) {
		super();

		this._betweenCellToolbar = this._register(new ToolBar(this._bottomCellToolbarContainer, contextMenuService, {
			actionViewItemProvider: action => {
				if (action instanceof MenuItemAction) {
					if (this._notebookEditor.notebookOptions.getLayoutConfiguration().insertToolbarAlignment === 'center') {
						return instantiationService.createInstance(CodiconActionViewItem, action, undefined);
					} else {
						return instantiationService.createInstance(MenuEntryActionViewItem, action, undefined);
					}
				}

				return undefined;
			}
		}));

		const menu = this._register(menuService.createMenu(this._notebookEditor.creationOptions.menuIds.cellInsertToolbar, contextKeyService));
		const updateActions = () => {
			const actions = getCellToolbarActions(menu);
			this._betweenCellToolbar.setActions(actions.primary, actions.secondary);
		};

		this._register(menu.onDidChange(() => updateActions()));
		this._register(this._notebookEditor.notebookOptions.onDidChangeOptions((e) => {
			if (e.insertToolbarAlignment) {
				updateActions();
			}
		}));
		updateActions();
	}

	updateContext(context: INotebookCellActionContext) {
		this._betweenCellToolbar.context = context;
	}

	override didRenderCell(element: ICellViewModel): void {
		this._betweenCellToolbar.context = <INotebookCellActionContext>{
			ui: true,
			cell: element,
			notebookEditor: this._notebookEditor,
			$mid: MarshalledId.NotebookCellActionContext
		};
	}

	override updateInternalLayoutNow(element: ICellViewModel) {
		const bottomToolbarOffset = element.layoutInfo.bottomToolbarOffset;
		this._bottomCellToolbarContainer.style.transform = `translateY(${bottomToolbarOffset}px)`;
	}
}


export interface ICssClassDelegate {
	toggle: (className: string, force?: boolean) => void;
}

export class CellTitleToolbarPart extends CellPart {
	private _toolbar: ToolBar;
	private _titleMenu: IMenu;
	private _deleteToolbar: ToolBar;
	private _deleteMenu: IMenu;
	private _toolbarActionsDisposables = this._register(new DisposableStore());
	private _deleteActionsDisposables = this._register(new DisposableStore());
	private readonly _onDidUpdateActions: Emitter<void> = this._register(new Emitter<void>());
	readonly onDidUpdateActions: Event<void> = this._onDidUpdateActions.event;

	get hasActions(): boolean {
		return this._toolbar.getItemsLength() + this._deleteToolbar.getItemsLength() > 0;
	}

	constructor(
		private readonly toolbarContainer: HTMLElement,
		private readonly _rootClassDelegate: ICssClassDelegate,
		toolbarId: MenuId,
		deleteToolbarId: MenuId,
		private readonly _notebookEditor: INotebookEditorDelegate,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IMenuService menuService: IMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this._toolbar = instantiationService.invokeFunction(accessor => createToolbar(accessor, toolbarContainer));
		this._titleMenu = this._register(menuService.createMenu(toolbarId, contextKeyService));

		this._deleteToolbar = this._register(instantiationService.invokeFunction(accessor => createToolbar(accessor, toolbarContainer, 'cell-delete-toolbar')));
		this._deleteMenu = this._register(menuService.createMenu(deleteToolbarId, contextKeyService));
		if (!this._notebookEditor.creationOptions.isReadOnly) {
			const deleteActions = getCellToolbarActions(this._deleteMenu);
			this._deleteToolbar.setActions(deleteActions.primary, deleteActions.secondary);
		}

		this.setupChangeListeners(this._toolbar, this._titleMenu, this._toolbarActionsDisposables);
		this.setupChangeListeners(this._deleteToolbar, this._deleteMenu, this._deleteActionsDisposables);
	}

	override didRenderCell(element: ICellViewModel): void {
		this.cellDisposables.add(registerStickyScroll(this._notebookEditor, element, this.toolbarContainer, { extraOffset: 4, min: -14 }));

		this.updateContext(<INotebookCellActionContext>{
			ui: true,
			cell: element,
			notebookEditor: this._notebookEditor,
			$mid: MarshalledId.NotebookCellActionContext
		});
	}

	private updateContext(toolbarContext: INotebookCellActionContext) {
		this._toolbar.context = toolbarContext;
		this._deleteToolbar.context = toolbarContext;
	}

	private setupChangeListeners(toolbar: ToolBar, menu: IMenu, actionDisposables: DisposableStore): void {
		// #103926
		let dropdownIsVisible = false;
		let deferredUpdate: (() => void) | undefined;

		this.updateActions(toolbar, menu, actionDisposables);
		this._register(menu.onDidChange(() => {
			if (dropdownIsVisible) {
				deferredUpdate = () => this.updateActions(toolbar, menu, actionDisposables);
				return;
			}

			this.updateActions(toolbar, menu, actionDisposables);
		}));
		this._rootClassDelegate.toggle('cell-toolbar-dropdown-active', false);
		this._register(toolbar.onDidChangeDropdownVisibility(visible => {
			dropdownIsVisible = visible;
			this._rootClassDelegate.toggle('cell-toolbar-dropdown-active', visible);

			if (deferredUpdate && !visible) {
				this._register(disposableTimeout(() => {
					deferredUpdate?.();
				}));

				deferredUpdate = undefined;
			}
		}));
	}

	private updateActions(toolbar: ToolBar, menu: IMenu, actionDisposables: DisposableStore) {
		actionDisposables.clear();
		const actions = getCellToolbarActions(menu);
		actionDisposables.add(actions.disposable);

		const hadFocus = DOM.isAncestor(document.activeElement, toolbar.getElement());
		toolbar.setActions(actions.primary, actions.secondary);
		if (hadFocus) {
			this._notebookEditor.focus();
		}

		if (actions.primary.length || actions.secondary.length) {
			this._rootClassDelegate.toggle('cell-has-toolbar-actions', true);
			this._onDidUpdateActions.fire();
		} else {
			this._rootClassDelegate.toggle('cell-has-toolbar-actions', false);
			this._onDidUpdateActions.fire();
		}
	}
}

function getCellToolbarActions(menu: IMenu): { primary: IAction[]; secondary: IAction[]; disposable: IDisposable } {
	const primary: IAction[] = [];
	const secondary: IAction[] = [];
	const result = { primary, secondary };

	const disposable = createAndFillInActionBarActions(menu, { shouldForwardArgs: true }, result, g => /^inline/.test(g));

	return {
		...result,
		disposable
	};
}

function createToolbar(accessor: ServicesAccessor, container: HTMLElement, elementClass?: string): ToolBar {
	const contextMenuService = accessor.get(IContextMenuService);
	const keybindingService = accessor.get(IKeybindingService);
	const instantiationService = accessor.get(IInstantiationService);
	const toolbar = new ToolBar(container, contextMenuService, {
		getKeyBinding: action => keybindingService.lookupKeybinding(action.id),
		actionViewItemProvider: action => {
			return createActionViewItem(instantiationService, action);
		},
		renderDropdownAsChildElement: true
	});

	if (elementClass) {
		toolbar.getElement().classList.add(elementClass);
	}

	return toolbar;
}
