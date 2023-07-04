/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener } from 'vs/base/browser/dom';
import { IToolBarOptions, ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { IAction, Separator, SubmenuAction, toAction, WorkbenchActionExecutedClassification, WorkbenchActionExecutedEvent } from 'vs/base/common/actions';
import { coalesceInPlace } from 'vs/base/common/arrays';
import { BugIndicatingError } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';
import { createAndFillInActionBarActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenuActionOptions, IMenuService, MenuId, MenuItemAction, SubmenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export const enum HiddenItemStrategy {
	/** This toolbar doesn't support hiding*/
	NoHide = -1,
	/** Hidden items aren't shown anywhere */
	Ignore = 0,
	/** Hidden items move into the secondary group */
	RenderInSecondaryGroup = 1,
}

export type IWorkbenchToolBarOptions = IToolBarOptions & {

	/**
	 * Items of the primary group can be hidden. When this happens the item can
	 * - move into the secondary popup-menu, or
	 * - not be shown at all
	 */
	hiddenItemStrategy?: HiddenItemStrategy;

	/**
	 * Optional menu id which is used for a "Reset Menu" command. This should be the
	 * menu id that defines the contents of this workbench menu
	 */
	resetMenu?: MenuId;

	/**
	 * Optional menu id which items are used for the context menu of the toolbar.
	 */
	contextMenu?: MenuId;

	/**
	 * Optional options how menu actions are created and invoked
	 */
	menuOptions?: IMenuActionOptions;

	/**
	 * When set the `workbenchActionExecuted` is automatically send for each invoked action. The `from` property
	 * of the event will the passed `telemetrySource`-value
	 */
	telemetrySource?: string;

	/** This is controlled by the WorkbenchToolBar */
	allowContextMenu?: never;

	/**
	 * Maximun number of items that can shown. Extra items will be shown in the overflow menu.
	 */
	maxNumberOfItems?: number;
};

/**
 * The `WorkbenchToolBar` does
 * - support hiding of menu items
 * - lookup keybindings for each actions automatically
 * - send `workbenchActionExecuted`-events for each action
 *
 * See {@link MenuWorkbenchToolBar} for a toolbar that is backed by a menu.
 */
export class WorkbenchToolBar extends ToolBar {

	private readonly _sessionDisposables = this._store.add(new DisposableStore());

	constructor(
		container: HTMLElement,
		private _options: IWorkbenchToolBarOptions | undefined,
		@IMenuService private readonly _menuService: IMenuService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super(container, _contextMenuService, {
			// defaults
			getKeyBinding: (action) => keybindingService.lookupKeybinding(action.id) ?? undefined,
			// options (override defaults)
			..._options,
			// mandatory (overide options)
			allowContextMenu: true,
		});

		// telemetry logic
		if (_options?.telemetrySource) {
			this._store.add(this.actionBar.onDidRun(e => telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>(
				'workbenchActionExecuted',
				{ id: e.action.id, from: _options!.telemetrySource! })
			));
		}
	}

	override setActions(_primary: readonly IAction[], _secondary: readonly IAction[] = [], menuIds?: readonly MenuId[]): void {

		this._sessionDisposables.clear();
		const primary = _primary.slice();
		const secondary = _secondary.slice();
		const toggleActions: IAction[] = [];
		let toggleActionsCheckedCount: number = 0;

		const extraSecondary: IAction[] = [];

		let someAreHidden = false;
		// unless disabled, move all hidden items to secondary group or ignore them
		if (this._options?.hiddenItemStrategy !== HiddenItemStrategy.NoHide) {
			for (let i = 0; i < primary.length; i++) {
				const action = primary[i];
				if (!(action instanceof MenuItemAction) && !(action instanceof SubmenuItemAction)) {
					// console.warn(`Action ${action.id}/${action.label} is not a MenuItemAction`);
					continue;
				}
				if (!action.hideActions) {
					continue;
				}

				// collect all toggle actions
				toggleActions.push(action.hideActions.toggle);
				if (action.hideActions.toggle.checked) {
					toggleActionsCheckedCount++;
				}

				// hidden items move into overflow or ignore
				if (action.hideActions.isHidden) {
					someAreHidden = true;
					primary[i] = undefined!;
					if (this._options?.hiddenItemStrategy !== HiddenItemStrategy.Ignore) {
						extraSecondary[i] = action;
					}
				}
			}
		}

		// count for max
		if (this._options?.maxNumberOfItems !== undefined) {
			let count = 0;
			for (let i = 0; i < primary.length; i++) {
				const action = primary[i];
				if (!action) {
					continue;
				}
				if (++count >= this._options.maxNumberOfItems) {
					primary[i] = undefined!;
					extraSecondary[i] = action;
				}
			}
		}

		coalesceInPlace(primary);
		coalesceInPlace(extraSecondary);
		super.setActions(primary, Separator.join(extraSecondary, secondary));

		// add context menu for toggle actions
		if (toggleActions.length > 0) {
			this._sessionDisposables.add(addDisposableListener(this.getElement(), 'contextmenu', e => {

				const action = this.getItemAction(<HTMLElement>e.target);
				if (!(action)) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();

				let noHide = false;

				// last item cannot be hidden when using ignore strategy
				if (toggleActionsCheckedCount === 1 && this._options?.hiddenItemStrategy === HiddenItemStrategy.Ignore) {
					noHide = true;
					for (let i = 0; i < toggleActions.length; i++) {
						if (toggleActions[i].checked) {
							toggleActions[i] = toAction({
								id: action.id,
								label: action.label,
								checked: true,
								enabled: false,
								run() { }
							});
							break; // there is only one
						}
					}
				}

				// add "hide foo" actions
				let hideAction: IAction;
				if (!noHide && (action instanceof MenuItemAction || action instanceof SubmenuItemAction)) {
					if (!action.hideActions) {
						// no context menu for MenuItemAction instances that support no hiding
						// those are fake actions and need to be cleaned up
						return;
					}
					hideAction = action.hideActions.hide;

				} else {
					hideAction = toAction({
						id: 'label',
						label: localize('hide', "Hide"),
						enabled: false,
						run() { }
					});
				}

				const actions = Separator.join([hideAction], toggleActions);

				// add "Reset Menu" action
				if (this._options?.resetMenu && !menuIds) {
					menuIds = [this._options.resetMenu];
				}
				if (someAreHidden && menuIds) {
					actions.push(new Separator());
					actions.push(toAction({
						id: 'resetThisMenu',
						label: localize('resetThisMenu', "Reset Menu"),
						run: () => this._menuService.resetHiddenStates(menuIds)
					}));
				}

				this._contextMenuService.showContextMenu({
					getAnchor: () => e,
					getActions: () => actions,
					// add context menu actions (iff appicable)
					menuId: this._options?.contextMenu,
					menuActionOptions: { renderShortTitle: true, ...this._options?.menuOptions },
					contextKeyService: this._contextKeyService,
				});
			}));
		}
	}
}

// ---- MenuWorkbenchToolBar -------------------------------------------------


export interface IToolBarRenderOptions {
	/**
	 * Determines what groups are considered primary. Defaults to `navigation`. Items of the primary
	 * group are rendered with buttons and the rest is rendered in the secondary popup-menu.
	 */
	primaryGroup?: string | ((actionGroup: string) => boolean);

	/**
	 * Inlinse submenus with just a single item
	 */
	shouldInlineSubmenu?: (action: SubmenuAction, group: string, groupSize: number) => boolean;

	/**
	 * Should the primary group allow for separators.
	 */
	useSeparatorsInPrimaryActions?: boolean;
}

export interface IMenuWorkbenchToolBarOptions extends IWorkbenchToolBarOptions {

	/**
	 * Optional options to configure how the toolbar renderes items.
	 */
	toolbarOptions?: IToolBarRenderOptions;

	/**
	 * Only `undefined` to disable the reset command is allowed, otherwise the menus
	 * id is used.
	 */
	resetMenu?: undefined;
}

/**
 * A {@link WorkbenchToolBar workbench toolbar} that is purely driven from a {@link MenuId menu}-identifier.
 *
 * *Note* that Manual updates via `setActions` are NOT supported.
 */
export class MenuWorkbenchToolBar extends WorkbenchToolBar {

	private readonly _onDidChangeMenuItems = this._store.add(new Emitter<this>());
	readonly onDidChangeMenuItems: Event<this> = this._onDidChangeMenuItems.event;

	constructor(
		container: HTMLElement,
		menuId: MenuId,
		options: IMenuWorkbenchToolBarOptions | undefined,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super(container, { resetMenu: menuId, ...options }, menuService, contextKeyService, contextMenuService, keybindingService, telemetryService);

		// update logic
		const menu = this._store.add(menuService.createMenu(menuId, contextKeyService, { emitEventsForSubmenuChanges: true }));
		const updateToolbar = () => {
			const primary: IAction[] = [];
			const secondary: IAction[] = [];
			createAndFillInActionBarActions(
				menu,
				options?.menuOptions,
				{ primary, secondary },
				options?.toolbarOptions?.primaryGroup, options?.toolbarOptions?.shouldInlineSubmenu, options?.toolbarOptions?.useSeparatorsInPrimaryActions
			);
			super.setActions(primary, secondary);
		};

		this._store.add(menu.onDidChange(() => {
			updateToolbar();
			this._onDidChangeMenuItems.fire(this);
		}));
		updateToolbar();
	}

	/**
	 * @deprecated The WorkbenchToolBar does not support this method because it works with menus.
	 */
	override setActions(): void {
		throw new BugIndicatingError('This toolbar is populated from a menu.');
	}
}
