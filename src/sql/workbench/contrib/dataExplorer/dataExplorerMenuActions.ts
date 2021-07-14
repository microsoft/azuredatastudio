/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAction } from 'vs/base/common/actions';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { createAndFillInActionBarActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenuActionOptions, IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MenuActions } from 'vs/workbench/browser/menuActions';

export class DataExplorerMenuActions extends Disposable {

	private readonly menuActions: MenuActions;
	private readonly dataExplorerActions: MenuActions;
	private readonly contextMenuActionsDisposable = this._register(new MutableDisposable());

	private _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private _onDidChangeDataExplorer = this._register(new Emitter<void>());
	readonly onDidChangeDataExplorer: Event<void> = this._onDidChangeDataExplorer.event;

	constructor(
		menuId: MenuId,
		private readonly contextMenuId: MenuId | undefined,
		private readonly options: IMenuActionOptions | undefined,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IMenuService private readonly menuService: IMenuService,
	) {
		super();
		this.menuActions = this._register(new MenuActions(MenuId.ViewContainerTitle, this.options, menuService, contextKeyService));
		this.dataExplorerActions = this._register(new MenuActions(MenuId.DataExplorerAction, this.options, menuService, contextKeyService));
		this._register(this.menuActions.onDidChange(() => this._onDidChange.fire()));
		this._register(this.dataExplorerActions.onDidChange(() => this._onDidChangeDataExplorer.fire()));
	}

	getPrimaryActions(): IAction[] {
		return this.menuActions.primaryActions.concat(this.dataExplorerActions.primaryActions);
	}

	getSecondaryActions(): IAction[] {
		return this.menuActions.secondaryActions.concat(this.dataExplorerActions.secondaryActions);
	}

	getContextMenuActions(): IAction[] {
		const actions: IAction[] = [];
		if (this.contextMenuId) {
			const menu = this.menuService.createMenu(this.contextMenuId, this.contextKeyService);
			this.contextMenuActionsDisposable.value = createAndFillInActionBarActions(menu, this.options, { primary: [], secondary: actions });
			menu.dispose();
		}
		return actions;
	}

}
