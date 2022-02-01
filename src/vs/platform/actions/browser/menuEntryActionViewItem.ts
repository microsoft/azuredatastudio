/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, asCSSUrl, EventType, ModifierKeyEmitter, prepend } from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ActionViewItem, BaseActionViewItem } from 'vs/base/browser/ui/actionbar/actionViewItems';
import { DropdownMenuActionViewItem, IDropdownMenuActionViewItemOptions } from 'vs/base/browser/ui/dropdown/dropdownActionViewItem';
import { ActionRunner, IAction, IRunEvent, Separator, SubmenuAction } from 'vs/base/common/actions';
import { Event } from 'vs/base/common/event';
import { UILabelProvider } from 'vs/base/common/keybindingLabels';
import { KeyCode } from 'vs/base/common/keyCodes';
import { DisposableStore, IDisposable, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { isLinux, isWindows, OS } from 'vs/base/common/platform';
import 'vs/css!./menuEntryActionViewItem';
import { localize } from 'vs/nls';
import { ICommandAction, Icon, IMenu, IMenuActionOptions, IMenuService, MenuItemAction, SubmenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';

export function createAndFillInContextMenuActions(menu: IMenu, options: IMenuActionOptions | undefined, target: IAction[] | { primary: IAction[]; secondary: IAction[]; }, primaryGroup?: string): IDisposable {
	const groups = menu.getActions(options);
	const modifierKeyEmitter = ModifierKeyEmitter.getInstance();
	const useAlternativeActions = modifierKeyEmitter.keyStatus.altKey || ((isWindows || isLinux) && modifierKeyEmitter.keyStatus.shiftKey);
	fillInActions(groups, target, useAlternativeActions, primaryGroup ? actionGroup => actionGroup === primaryGroup : actionGroup => actionGroup === 'navigation');
	return asDisposable(groups);
}

export function createAndFillInActionBarActions(menu: IMenu, options: IMenuActionOptions | undefined, target: IAction[] | { primary: IAction[]; secondary: IAction[]; }, primaryGroup?: string | ((actionGroup: string) => boolean), primaryMaxCount?: number, shouldInlineSubmenu?: (action: SubmenuAction, group: string, groupSize: number) => boolean, useSeparatorsInPrimaryActions?: boolean): IDisposable {
	const groups = menu.getActions(options);
	const isPrimaryAction = typeof primaryGroup === 'string' ? (actionGroup: string) => actionGroup === primaryGroup : primaryGroup;

	// Action bars handle alternative actions on their own so the alternative actions should be ignored
	fillInActions(groups, target, false, isPrimaryAction, primaryMaxCount, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
	return asDisposable(groups);
}

function asDisposable(groups: ReadonlyArray<[string, ReadonlyArray<MenuItemAction | SubmenuItemAction>]>): IDisposable {
	const disposables = new DisposableStore();
	for (const [, actions] of groups) {
		for (const action of actions) {
			disposables.add(action);
		}
	}
	return disposables;
}

export function fillInActions( // {{SQL CARBON EDIT}} add export modifier
	groups: ReadonlyArray<[string, ReadonlyArray<MenuItemAction | SubmenuItemAction>]>, target: IAction[] | { primary: IAction[]; secondary: IAction[]; },
	useAlternativeActions: boolean,
	isPrimaryAction: (actionGroup: string) => boolean = actionGroup => actionGroup === 'navigation',
	primaryMaxCount: number = Number.MAX_SAFE_INTEGER,
	shouldInlineSubmenu: (action: SubmenuAction, group: string, groupSize: number) => boolean = () => false,
	useSeparatorsInPrimaryActions: boolean = false
): void {

	let primaryBucket: IAction[];
	let secondaryBucket: IAction[];
	if (Array.isArray(target)) {
		primaryBucket = target;
		secondaryBucket = target;
	} else {
		primaryBucket = target.primary;
		secondaryBucket = target.secondary;
	}

	const submenuInfo = new Set<{ group: string, action: SubmenuAction, index: number }>();

	for (const [group, actions] of groups) {

		let target: IAction[];
		if (isPrimaryAction(group)) {
			target = primaryBucket;
			if (target.length > 0 && useSeparatorsInPrimaryActions) {
				target.push(new Separator());
			}
		} else {
			target = secondaryBucket;
			if (target.length > 0) {
				target.push(new Separator());
			}
		}

		for (let action of actions) {
			if (useAlternativeActions) {
				action = action instanceof MenuItemAction && action.alt ? action.alt : action;
			}
			const newLen = target.push(action);
			// keep submenu info for later inlining
			if (action instanceof SubmenuAction) {
				submenuInfo.add({ group, action, index: newLen - 1 });
			}
		}
	}

	// ask the outside if submenu should be inlined or not. only ask when
	// there would be enough space
	for (const { group, action, index } of submenuInfo) {
		const target = isPrimaryAction(group) ? primaryBucket : secondaryBucket;

		// inlining submenus with length 0 or 1 is easy,
		// larger submenus need to be checked with the overall limit
		const submenuActions = action.actions;
		if ((submenuActions.length <= 1 || target.length + submenuActions.length - 2 <= primaryMaxCount) && shouldInlineSubmenu(action, group, target.length)) {
			target.splice(index, 1, ...submenuActions);
		}
	}

	// overflow items from the primary group into the secondary bucket
	if (primaryBucket !== secondaryBucket && primaryBucket.length > primaryMaxCount) {
		const overflow = primaryBucket.splice(primaryMaxCount, primaryBucket.length - primaryMaxCount);
		secondaryBucket.unshift(...overflow, new Separator());
	}
}

export interface IMenuEntryActionViewItemOptions {
	draggable?: boolean;
}

export class MenuEntryActionViewItem extends ActionViewItem {

	private _wantsAltCommand: boolean = false;
	private readonly _itemClassDispose = this._register(new MutableDisposable());
	private readonly _altKey: ModifierKeyEmitter;

	constructor(
		_action: MenuItemAction,
		options: IMenuEntryActionViewItemOptions | undefined,
		@IKeybindingService protected readonly _keybindingService: IKeybindingService,
		@INotificationService protected _notificationService: INotificationService,
		@IContextKeyService protected _contextKeyService: IContextKeyService
	) {
		super(undefined, _action, { icon: !!(_action.class || _action.item.icon), label: !_action.class && !_action.item.icon, draggable: options?.draggable });
		this._altKey = ModifierKeyEmitter.getInstance();
	}

	protected get _menuItemAction(): MenuItemAction {
		return <MenuItemAction>this._action;
	}

	protected get _commandAction(): MenuItemAction {
		return this._wantsAltCommand && this._menuItemAction.alt || this._menuItemAction;
	}

	override async onClick(event: MouseEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();

		try {
			await this.actionRunner.run(this._commandAction, this._context);
		} catch (err) {
			this._notificationService.error(err);
		}
	}

	override render(container: HTMLElement): void {
		super.render(container);
		container.classList.add('menu-entry');

		this._updateItemClass(this._menuItemAction.item);

		let mouseOver = false;

		let alternativeKeyDown = this._altKey.keyStatus.altKey || ((isWindows || isLinux) && this._altKey.keyStatus.shiftKey);

		const updateAltState = () => {
			const wantsAltCommand = mouseOver && alternativeKeyDown;
			if (wantsAltCommand !== this._wantsAltCommand) {
				this._wantsAltCommand = wantsAltCommand;
				this.updateLabel();
				this.updateTooltip();
				this.updateClass();
			}
		};

		if (this._menuItemAction.alt) {
			this._register(this._altKey.event(value => {
				alternativeKeyDown = value.altKey || ((isWindows || isLinux) && value.shiftKey);
				updateAltState();
			}));
		}

		this._register(addDisposableListener(container, 'mouseleave', _ => {
			mouseOver = false;
			updateAltState();
		}));

		this._register(addDisposableListener(container, 'mouseenter', _ => {
			mouseOver = true;
			updateAltState();
		}));
	}

	override updateLabel(): void {
		if (this.options.label && this.label) {
			this.label.textContent = this._commandAction.label;
		}
	}

	override updateTooltip(): void {
		if (this.label) {
			const keybinding = this._keybindingService.lookupKeybinding(this._commandAction.id, this._contextKeyService);
			const keybindingLabel = keybinding && keybinding.getLabel();

			const tooltip = this._commandAction.tooltip || this._commandAction.label;
			let title = keybindingLabel
				? localize('titleAndKb', "{0} ({1})", tooltip, keybindingLabel)
				: tooltip;
			if (!this._wantsAltCommand && this._menuItemAction.alt) {
				const altTooltip = this._menuItemAction.alt.tooltip || this._menuItemAction.alt.label;
				const altKeybinding = this._keybindingService.lookupKeybinding(this._menuItemAction.alt.id, this._contextKeyService);
				const altKeybindingLabel = altKeybinding && altKeybinding.getLabel();
				const altTitleSection = altKeybindingLabel
					? localize('titleAndKb', "{0} ({1})", altTooltip, altKeybindingLabel)
					: altTooltip;
				title += `\n[${UILabelProvider.modifierLabels[OS].altKey}] ${altTitleSection}`;
			}
			this.label.title = title;
		}
	}

	override updateClass(): void {
		if (this.options.icon) {
			if (this._commandAction !== this._menuItemAction) {
				if (this._menuItemAction.alt) {
					this._updateItemClass(this._menuItemAction.alt.item);
				}
			} else if (this._menuItemAction.alt) {
				this._updateItemClass(this._menuItemAction.item);
			}
		}
	}

	protected _updateItemClass(item: ICommandAction): void { // {{SQL CARBON EDIT}} make it overwritable
		this._itemClassDispose.value = undefined;

		const { element, label } = this;
		if (!element || !label) {
			return;
		}

		const icon = this._commandAction.checked && (item.toggled as { icon?: Icon })?.icon ? (item.toggled as { icon: Icon }).icon : item.icon;

		if (!icon) {
			return;
		}

		if (ThemeIcon.isThemeIcon(icon)) {
			// theme icons
			const iconClasses = ThemeIcon.asClassNameArray(icon);
			label.classList.add(...iconClasses);
			this._itemClassDispose.value = toDisposable(() => {
				label.classList.remove(...iconClasses);
			});

		} else {
			// icon path/url
			if (icon.light) {
				label.style.setProperty('--menu-entry-icon-light', asCSSUrl(icon.light));
			}
			if (icon.dark) {
				label.style.setProperty('--menu-entry-icon-dark', asCSSUrl(icon.dark));
			}
			label.classList.add('icon');
			this._itemClassDispose.value = toDisposable(() => {
				label.classList.remove('icon');
				label.style.removeProperty('--menu-entry-icon-light');
				label.style.removeProperty('--menu-entry-icon-dark');
			});
		}
	}
}

export class SubmenuEntryActionViewItem extends DropdownMenuActionViewItem {

	constructor(
		action: SubmenuItemAction,
		options: IDropdownMenuActionViewItemOptions | undefined,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		const dropdownOptions = Object.assign({}, options ?? Object.create(null), {
			menuAsChild: options?.menuAsChild ?? true,
			classNames: options?.classNames ?? (ThemeIcon.isThemeIcon(action.item.icon) ? ThemeIcon.asClassName(action.item.icon) : undefined),
		});

		super(action, { getActions: () => action.actions }, contextMenuService, dropdownOptions);
	}

	override render(container: HTMLElement): void {
		super.render(container);
		if (this.element) {
			container.classList.add('menu-entry');
			const { icon } = (<SubmenuItemAction>this._action).item;
			if (icon && !ThemeIcon.isThemeIcon(icon)) {
				this.element.classList.add('icon');
				if (icon.light) {
					this.element.style.setProperty('--menu-entry-icon-light', asCSSUrl(icon.light));
				}
				if (icon.dark) {
					this.element.style.setProperty('--menu-entry-icon-dark', asCSSUrl(icon.dark));
				}
			}
		}
	}
}

class DropdownWithDefaultActionViewItem extends BaseActionViewItem {
	private _defaultAction: ActionViewItem;
	private _dropdown: DropdownMenuActionViewItem;
	private _container: HTMLElement | null = null;
	private _storageKey: string;

	get onDidChangeDropdownVisibility(): Event<boolean> {
		return this._dropdown.onDidChangeVisibility;
	}

	constructor(
		submenuAction: SubmenuItemAction,
		options: IDropdownMenuActionViewItemOptions | undefined,
		@IKeybindingService protected readonly _keybindingService: IKeybindingService,
		@INotificationService protected _notificationService: INotificationService,
		@IContextMenuService protected _contextMenuService: IContextMenuService,
		@IMenuService protected _menuService: IMenuService,
		@IInstantiationService protected _instaService: IInstantiationService,
		@IStorageService protected _storageService: IStorageService
	) {
		super(null, submenuAction);

		this._storageKey = `${submenuAction.item.submenu._debugName}_lastActionId`;

		// determine default action
		let defaultAction: IAction | undefined;
		let defaultActionId = _storageService.get(this._storageKey, StorageScope.WORKSPACE);
		if (defaultActionId) {
			defaultAction = submenuAction.actions.find(a => defaultActionId === a.id);
		}
		if (!defaultAction) {
			defaultAction = submenuAction.actions[0];
		}

		this._defaultAction = this._instaService.createInstance(MenuEntryActionViewItem, <MenuItemAction>defaultAction, undefined);

		const dropdownOptions = Object.assign({}, options ?? Object.create(null), {
			menuAsChild: options?.menuAsChild ?? true,
			classNames: options?.classNames ?? ['codicon', 'codicon-chevron-down'],
			actionRunner: options?.actionRunner ?? new ActionRunner()
		});

		this._dropdown = new DropdownMenuActionViewItem(submenuAction, submenuAction.actions, this._contextMenuService, dropdownOptions);
		this._dropdown.actionRunner.onDidRun((e: IRunEvent) => {
			if (e.action instanceof MenuItemAction) {
				this.update(e.action);
			}
		});
	}

	private update(lastAction: MenuItemAction): void {
		this._storageService.store(this._storageKey, lastAction.id, StorageScope.WORKSPACE, StorageTarget.USER);

		this._defaultAction.dispose();
		this._defaultAction = this._instaService.createInstance(MenuEntryActionViewItem, lastAction, undefined);
		this._defaultAction.actionRunner = new class extends ActionRunner {
			override async runAction(action: IAction, context?: unknown): Promise<void> {
				await action.run(undefined);
			}
		}();

		if (this._container) {
			this._defaultAction.render(prepend(this._container, $('.action-container')));
		}
	}

	override setActionContext(newContext: unknown): void {
		super.setActionContext(newContext);
		this._defaultAction.setActionContext(newContext);
		this._dropdown.setActionContext(newContext);
	}

	override render(container: HTMLElement): void {
		this._container = container;
		super.render(this._container);

		this._container.classList.add('monaco-dropdown-with-default');

		const primaryContainer = $('.action-container');
		this._defaultAction.render(append(this._container, primaryContainer));
		this._register(addDisposableListener(primaryContainer, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.RightArrow)) {
				this._defaultAction.element!.tabIndex = -1;
				this._dropdown.focus();
				event.stopPropagation();
			}
		}));

		const dropdownContainer = $('.dropdown-action-container');
		this._dropdown.render(append(this._container, dropdownContainer));
		this._register(addDisposableListener(dropdownContainer, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.LeftArrow)) {
				this._defaultAction.element!.tabIndex = 0;
				this._dropdown.setFocusable(false);
				this._defaultAction.element?.focus();
				event.stopPropagation();
			}
		}));
	}

	override focus(fromRight?: boolean): void {
		if (fromRight) {
			this._dropdown.focus();
		} else {
			this._defaultAction.element!.tabIndex = 0;
			this._defaultAction.element!.focus();
		}
	}

	override blur(): void {
		this._defaultAction.element!.tabIndex = -1;
		this._dropdown.blur();
		this._container!.blur();
	}

	override setFocusable(focusable: boolean): void {
		if (focusable) {
			this._defaultAction.element!.tabIndex = 0;
		} else {
			this._defaultAction.element!.tabIndex = -1;
			this._dropdown.setFocusable(false);
		}
	}

	override dispose() {
		this._defaultAction.dispose();
		this._dropdown.dispose();
		super.dispose();
	}
}

/**
 * Creates action view items for menu actions or submenu actions.
 */
export function createActionViewItem(instaService: IInstantiationService, action: IAction, options?: IDropdownMenuActionViewItemOptions): undefined | MenuEntryActionViewItem | SubmenuEntryActionViewItem | BaseActionViewItem {
	if (action instanceof MenuItemAction) {
		return instaService.createInstance(MenuEntryActionViewItem, action, undefined);
	} else if (action instanceof SubmenuItemAction) {
		if (action.item.rememberDefaultAction) {
			return instaService.createInstance(DropdownWithDefaultActionViewItem, action, options);
		} else {
			return instaService.createInstance(SubmenuEntryActionViewItem, action, options);
		}
	} else {
		return undefined;
	}
}
