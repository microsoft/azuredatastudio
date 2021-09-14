/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LayoutPriority, Orientation, Sizing, SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable, dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITerminalInstance, ITerminalService, TerminalConnectionState } from 'vs/workbench/contrib/terminal/browser/terminal';
import { TerminalFindWidget } from 'vs/workbench/contrib/terminal/browser/terminalFindWidget';
import { TerminalTabsListSizes, TerminalTabList } from 'vs/workbench/contrib/terminal/browser/terminalTabsList';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { isLinux, isMacintosh } from 'vs/base/common/platform';
import * as dom from 'vs/base/browser/dom';
import { BrowserFeatures } from 'vs/base/browser/canIUse';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { StandardMouseEvent } from 'vs/base/browser/mouseEvent';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { Action, IAction, Separator } from 'vs/base/common/actions';
import { IMenu, IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { KEYBINDING_CONTEXT_TERMINAL_FIND_VISIBLE, KEYBINDING_CONTEXT_TERMINAL_IS_TABS_NARROW_FOCUS, KEYBINDING_CONTEXT_TERMINAL_TABS_FOCUS, KEYBINDING_CONTEXT_TERMINAL_TABS_MOUSE } from 'vs/workbench/contrib/terminal/common/terminal';
import { TerminalSettingId } from 'vs/platform/terminal/common/terminal';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { localize } from 'vs/nls';

const $ = dom.$;

const FIND_FOCUS_CLASS = 'find-focused';
const TABS_LIST_WIDTH_HORIZONTAL_KEY = 'tabs-list-width-horizontal';
const TABS_LIST_WIDTH_VERTICAL_KEY = 'tabs-list-width-vertical';
const STATUS_ICON_WIDTH = 30;
const SPLIT_ANNOTATION_WIDTH = 30;

export class TerminalTabbedView extends Disposable {

	private _splitView: SplitView;

	private _terminalContainer: HTMLElement;
	private _tabListElement: HTMLElement;
	private _parentElement: HTMLElement;
	private _tabContainer: HTMLElement;

	private _tabList: TerminalTabList;
	private _findWidget: TerminalFindWidget;
	private _sashDisposables: IDisposable[] | undefined;

	private _plusButton: HTMLElement | undefined;

	private _tabTreeIndex: number;
	private _terminalContainerIndex: number;

	private _findWidgetVisible: IContextKey<boolean>;

	private _height: number | undefined;
	private _width: number | undefined;

	private _cancelContextMenu: boolean = false;
	private _instanceMenu: IMenu;
	private _tabsListMenu: IMenu;
	private _tabsListEmptyMenu: IMenu;

	private _terminalIsTabsNarrowContextKey: IContextKey<boolean>;
	private _terminalTabsFocusContextKey: IContextKey<boolean>;
	private _terminalTabsMouseContextKey: IContextKey<boolean>;

	private _panelOrientation: Orientation | undefined;

	constructor(
		parentElement: HTMLElement,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@IThemeService private readonly _themeService: IThemeService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IMenuService menuService: IMenuService,
		@IStorageService private readonly _storageService: IStorageService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();

		this._parentElement = parentElement;

		this._tabContainer = $('.tabs-container');
		const tabListContainer = $('.tabs-list-container');
		this._tabListElement = $('.tabs-list');
		tabListContainer.appendChild(this._tabListElement);
		this._tabContainer.appendChild(tabListContainer);

		this._instanceMenu = this._register(menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService));
		this._tabsListMenu = this._register(menuService.createMenu(MenuId.TerminalTabContext, contextKeyService));
		this._tabsListEmptyMenu = this._register(menuService.createMenu(MenuId.TerminalTabEmptyAreaContext, contextKeyService));

		this._tabList = this._register(this._instantiationService.createInstance(TerminalTabList, this._tabListElement));

		const terminalOuterContainer = $('.terminal-outer-container');
		this._terminalContainer = $('.terminal-groups-container');
		terminalOuterContainer.appendChild(this._terminalContainer);

		this._findWidget = this._register(this._instantiationService.createInstance(TerminalFindWidget, this._terminalService.getFindState()));
		terminalOuterContainer.appendChild(this._findWidget.getDomNode());

		this._terminalService.setContainers(parentElement, this._terminalContainer);

		this._terminalIsTabsNarrowContextKey = KEYBINDING_CONTEXT_TERMINAL_IS_TABS_NARROW_FOCUS.bindTo(contextKeyService);
		this._terminalTabsFocusContextKey = KEYBINDING_CONTEXT_TERMINAL_TABS_FOCUS.bindTo(contextKeyService);
		this._terminalTabsMouseContextKey = KEYBINDING_CONTEXT_TERMINAL_TABS_MOUSE.bindTo(contextKeyService);
		this._findWidgetVisible = KEYBINDING_CONTEXT_TERMINAL_FIND_VISIBLE.bindTo(contextKeyService);

		this._tabTreeIndex = this._terminalService.configHelper.config.tabs.location === 'left' ? 0 : 1;
		this._terminalContainerIndex = this._terminalService.configHelper.config.tabs.location === 'left' ? 1 : 0;

		_configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(TerminalSettingId.TabsEnabled) ||
				e.affectsConfiguration(TerminalSettingId.TabsHideCondition)) {
				this._refreshShowTabs();
			} else if (e.affectsConfiguration(TerminalSettingId.TabsLocation)) {
				this._tabTreeIndex = this._terminalService.configHelper.config.tabs.location === 'left' ? 0 : 1;
				this._terminalContainerIndex = this._terminalService.configHelper.config.tabs.location === 'left' ? 1 : 0;
				if (this._shouldShowTabs()) {
					this._splitView.swapViews(0, 1);
					this._removeSashListener();
					this._addSashListener();
					this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
				}
			}
		});
		this._register(this._terminalService.onInstancesChanged(() => this._refreshShowTabs()));
		this._register(this._terminalService.onGroupsChanged(() => this._refreshShowTabs()));
		this._register(this._themeService.onDidColorThemeChange(theme => this._updateTheme(theme)));
		this._updateTheme();

		this._findWidget.focusTracker.onDidFocus(() => this._terminalContainer.classList.add(FIND_FOCUS_CLASS));
		this._findWidget.focusTracker.onDidBlur(() => this._terminalContainer.classList.remove(FIND_FOCUS_CLASS));

		this._attachEventListeners(parentElement, this._terminalContainer);

		this._terminalService.onPanelOrientationChanged((orientation) => {
			this._panelOrientation = orientation;
		});

		this._splitView = new SplitView(parentElement, { orientation: Orientation.HORIZONTAL, proportionalLayout: false });

		this._setupSplitView(terminalOuterContainer);
	}

	private _shouldShowTabs(): boolean {
		const enabled = this._terminalService.configHelper.config.tabs.enabled;
		const hide = this._terminalService.configHelper.config.tabs.hideCondition;
		if (!enabled) {
			return false;
		}

		if (hide === 'never') {
			return true;
		}

		if (hide === 'singleTerminal' && this._terminalService.terminalInstances.length > 1) {
			return true;
		}

		if (hide === 'singleGroup' && this._terminalService.terminalGroups.length > 1) {
			return true;
		}

		return false;
	}

	private _refreshShowTabs() {
		if (this._shouldShowTabs()) {
			if (this._splitView.length === 1) {
				this._addTabTree();
				this._addSashListener();
				this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
				this._rerenderTabs();
			}
		} else {
			if (this._splitView.length === 2 && !this._terminalTabsMouseContextKey.get()) {
				this._splitView.removeView(this._tabTreeIndex);
				if (this._plusButton) {
					this._tabContainer.removeChild(this._plusButton);
				}
				this._removeSashListener();
			}
		}
	}

	private _getLastListWidth(): number {
		const widthKey = this._panelOrientation === Orientation.VERTICAL ? TABS_LIST_WIDTH_VERTICAL_KEY : TABS_LIST_WIDTH_HORIZONTAL_KEY;
		const storedValue = this._storageService.get(widthKey, StorageScope.GLOBAL);

		if (!storedValue || !parseInt(storedValue)) {
			// we want to use the min width by default for the vertical orientation bc
			// there is such a limited width for the terminal panel to begin w there.
			return this._panelOrientation === Orientation.VERTICAL ? TerminalTabsListSizes.NarrowViewWidth : TerminalTabsListSizes.DefaultWidth;
		}
		return parseInt(storedValue);
	}

	private _handleOnDidSashReset(): void {
		// Calculate ideal size of list to display all text based on its contents
		let idealWidth = TerminalTabsListSizes.WideViewMinimumWidth;
		const offscreenCanvas = new OffscreenCanvas(1, 1);
		const ctx = offscreenCanvas.getContext('2d');
		if (ctx) {
			const style = window.getComputedStyle(this._tabListElement);
			ctx.font = `${style.fontStyle} ${style.fontSize} ${style.fontFamily}`;
			const maxInstanceWidth = this._terminalService.terminalInstances.reduce((p, c) => {
				return Math.max(p, ctx.measureText(c.title + (c.shellLaunchConfig.description || '')).width + this._getAdditionalWidth(c));
			}, 0);
			idealWidth = Math.ceil(Math.max(maxInstanceWidth, TerminalTabsListSizes.WideViewMinimumWidth));
		}
		// If the size is already ideal, toggle to collapsed
		const currentWidth = Math.ceil(this._splitView.getViewSize(this._tabTreeIndex));
		if (currentWidth === idealWidth) {
			idealWidth = TerminalTabsListSizes.NarrowViewWidth;
		}
		this._splitView.resizeView(this._tabTreeIndex, idealWidth);
		this._updateListWidth(idealWidth);
	}

	private _getAdditionalWidth(instance: ITerminalInstance): number {
		// Size to include padding, icon, status icon (if any), split annotation (if any), + a little more
		const additionalWidth = 30;
		const statusIconWidth = instance.statusList.statuses.length > 0 ? STATUS_ICON_WIDTH : 0;
		const splitAnnotationWidth = (this._terminalService.getGroupForInstance(instance)?.terminalInstances.length || 0) > 1 ? SPLIT_ANNOTATION_WIDTH : 0;
		return additionalWidth + splitAnnotationWidth + statusIconWidth;
	}

	private _handleOnDidSashChange(): void {
		const listWidth = this._splitView.getViewSize(this._tabTreeIndex);
		if (!this._width || listWidth <= 0) {
			return;
		}
		this._updateListWidth(listWidth);
	}

	private _updateListWidth(width: number): void {
		if (width < TerminalTabsListSizes.MidpointViewWidth && width >= TerminalTabsListSizes.NarrowViewWidth) {
			width = TerminalTabsListSizes.NarrowViewWidth;
			this._splitView.resizeView(this._tabTreeIndex, width);
		} else if (width >= TerminalTabsListSizes.MidpointViewWidth && width < TerminalTabsListSizes.WideViewMinimumWidth) {
			width = TerminalTabsListSizes.WideViewMinimumWidth;
			this._splitView.resizeView(this._tabTreeIndex, width);
		}
		this._rerenderTabs();
		const widthKey = this._panelOrientation === Orientation.VERTICAL ? TABS_LIST_WIDTH_VERTICAL_KEY : TABS_LIST_WIDTH_HORIZONTAL_KEY;
		this._storageService.store(widthKey, width, StorageScope.GLOBAL, StorageTarget.USER);
	}

	private _setupSplitView(terminalOuterContainer: HTMLElement): void {
		this._register(this._splitView.onDidSashReset(() => this._handleOnDidSashReset()));
		this._register(this._splitView.onDidSashChange(() => this._handleOnDidSashChange()));

		if (this._shouldShowTabs()) {
			this._addTabTree();
		}
		this._splitView.addView({
			element: terminalOuterContainer,
			layout: width => this._terminalService.terminalGroups.forEach(tab => tab.layout(width, this._height || 0)),
			minimumSize: 120,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: () => Disposable.None,
			priority: LayoutPriority.High
		}, Sizing.Distribute, this._terminalContainerIndex);

		if (this._shouldShowTabs()) {
			this._addSashListener();
		}
	}

	private _addTabTree() {
		this._splitView.addView({
			element: this._tabContainer,
			layout: width => this._tabList.layout(this._height || 0, width),
			minimumSize: TerminalTabsListSizes.NarrowViewWidth,
			maximumSize: TerminalTabsListSizes.MaximumWidth,
			onDidChange: () => Disposable.None,
			priority: LayoutPriority.Low
		}, Sizing.Distribute, this._tabTreeIndex);
		this._rerenderTabs();
	}

	private _rerenderTabs() {
		const hasText = this._tabListElement.clientWidth > TerminalTabsListSizes.MidpointViewWidth;
		this._tabContainer.classList.toggle('has-text', hasText);
		this._terminalIsTabsNarrowContextKey.set(!hasText);
		this._tabList.refresh();
	}

	private _addSashListener() {
		let interval: number;
		this._sashDisposables = [
			this._splitView.sashes[0].onDidStart(e => {
				interval = window.setInterval(() => {
					this._rerenderTabs();
				}, 100);
			}),
			this._splitView.sashes[0].onDidEnd(e => {
				window.clearInterval(interval);
				interval = 0;
			})
		];
	}

	private _removeSashListener() {
		if (this._sashDisposables) {
			dispose(this._sashDisposables);
			this._sashDisposables = undefined;
		}
	}

	layout(width: number, height: number): void {
		this._height = height;
		this._width = width;
		this._splitView.layout(width);
		if (this._shouldShowTabs()) {
			this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
		}
		this._rerenderTabs();
	}

	private _updateTheme(theme?: IColorTheme): void {
		if (!theme) {
			theme = this._themeService.getColorTheme();
		}

		this._findWidget?.updateTheme(theme);
	}

	private _attachEventListeners(parentDomElement: HTMLElement, terminalContainer: HTMLElement): void {
		this._register(dom.addDisposableListener(this._tabContainer, 'mouseleave', async (event: MouseEvent) => {
			this._terminalTabsMouseContextKey.set(false);
			this._refreshShowTabs();
			event.stopPropagation();
		}));
		this._register(dom.addDisposableListener(this._tabContainer, 'mouseenter', async (event: MouseEvent) => {
			this._terminalTabsMouseContextKey.set(true);
			event.stopPropagation();
		}));
		this._register(dom.addDisposableListener(terminalContainer, 'mousedown', async (event: MouseEvent) => {
			if (this._terminalService.terminalInstances.length === 0) {
				return;
			}

			if (event.which === 2 && isLinux) {
				// Drop selection and focus terminal on Linux to enable middle button paste when click
				// occurs on the selection itself.
				const terminal = this._terminalService.getActiveInstance();
				if (terminal) {
					terminal.focus();
				}
			} else if (event.which === 3) {
				const rightClickBehavior = this._terminalService.configHelper.config.rightClickBehavior;
				if (rightClickBehavior === 'copyPaste' || rightClickBehavior === 'paste') {
					const terminal = this._terminalService.getActiveInstance();
					if (!terminal) {
						return;
					}

					// copyPaste: Shift+right click should open context menu
					if (rightClickBehavior === 'copyPaste' && event.shiftKey) {
						this._openContextMenu(event, parentDomElement);
						return;
					}

					if (rightClickBehavior === 'copyPaste' && terminal.hasSelection()) {
						await terminal.copySelection();
						terminal.clearSelection();
					} else {
						if (BrowserFeatures.clipboard.readText) {
							terminal.paste();
						} else {
							this._notificationService.info(`This browser doesn't support the clipboard.readText API needed to trigger a paste, try ${isMacintosh ? '⌘' : 'Ctrl'}+V instead.`);
						}
					}
					// Clear selection after all click event bubbling is finished on Mac to prevent
					// right-click selecting a word which is seemed cannot be disabled. There is a
					// flicker when pasting but this appears to give the best experience if the
					// setting is enabled.
					if (isMacintosh) {
						setTimeout(() => {
							terminal.clearSelection();
						}, 0);
					}
					this._cancelContextMenu = true;
				}
			}
		}));
		this._register(dom.addDisposableListener(terminalContainer, 'contextmenu', (event: MouseEvent) => {
			if (!this._cancelContextMenu) {
				this._openContextMenu(event, terminalContainer);
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			this._cancelContextMenu = false;
		}));
		this._register(dom.addDisposableListener(this._tabContainer, 'contextmenu', (event: MouseEvent) => {
			if (!this._cancelContextMenu) {
				this._openContextMenu(event, this._tabContainer);
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			this._cancelContextMenu = false;
		}));
		this._register(dom.addDisposableListener(document, 'keydown', (event: KeyboardEvent) => {
			terminalContainer.classList.toggle('alt-active', !!event.altKey);
		}));
		this._register(dom.addDisposableListener(document, 'keyup', (event: KeyboardEvent) => {
			terminalContainer.classList.toggle('alt-active', !!event.altKey);
		}));
		this._register(dom.addDisposableListener(parentDomElement, 'keyup', (event: KeyboardEvent) => {
			if (event.keyCode === 27) {
				// Keep terminal open on escape
				event.stopPropagation();
			}
		}));
		this._register(dom.addDisposableListener(this._tabContainer, dom.EventType.FOCUS_IN, () => {
			this._terminalTabsFocusContextKey.set(true);
		}));
		this._register(dom.addDisposableListener(this._tabContainer, dom.EventType.FOCUS_OUT, () => {
			this._terminalTabsFocusContextKey.set(false);
		}));
	}

	private _openContextMenu(event: MouseEvent, parent: HTMLElement): void {
		const standardEvent = new StandardMouseEvent(event);

		const anchor: { x: number, y: number } = { x: standardEvent.posx, y: standardEvent.posy };
		const actions: IAction[] = [];
		let menu: IMenu;
		if (parent === this._terminalContainer) {
			menu = this._instanceMenu;
		} else {
			menu = this._tabList.getFocus().length === 0 ? this._tabsListEmptyMenu : this._tabsListMenu;
		}

		const actionsDisposable = createAndFillInContextMenuActions(menu, undefined, actions);

		// TODO: Convert to command?
		if (menu === this._tabsListEmptyMenu) {
			actions.push(...this._getTabActions());
		}

		this._contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => actions,
			getActionsContext: () => this._parentElement,
			onHide: () => actionsDisposable.dispose()
		});
	}

	private _getTabActions(): Action[] {
		return [
			new Separator(),
			this._configurationService.inspect(TerminalSettingId.TabsLocation).userValue === 'left' ?
				new Action('moveRight', localize('moveTabsRight', "Move Tabs Right"), undefined, undefined, async () => {
					this._configurationService.updateValue(TerminalSettingId.TabsLocation, 'right');
				}) :
				new Action('moveLeft', localize('moveTabsLeft', "Move Tabs Left"), undefined, undefined, async () => {
					this._configurationService.updateValue(TerminalSettingId.TabsLocation, 'left');
				}),
			new Action('hideTabs', localize('hideTabs', "Hide Tabs"), undefined, undefined, async () => {
				this._configurationService.updateValue(TerminalSettingId.TabsEnabled, false);
			})
		];
	}

	setEditable(isEditing: boolean): void {
		if (!isEditing) {
			this._tabList.domFocus();
		}
		return this._tabList.refresh();
	}

	focusTabs(): void {
		if (!this._shouldShowTabs()) {
			return;
		}
		this._terminalTabsFocusContextKey.set(true);
		const selected = this._tabList.getSelection();
		this._tabList.domFocus();
		if (selected) {
			this._tabList.setFocus(selected);
		}
	}

	focusFindWidget() {
		this._findWidgetVisible.set(true);
		const activeInstance = this._terminalService.getActiveInstance();
		if (activeInstance && activeInstance.hasSelection() && activeInstance.selection!.indexOf('\n') === -1) {
			this._findWidget!.reveal(activeInstance.selection);
		} else {
			this._findWidget!.reveal();
		}
	}

	hideFindWidget() {
		this._findWidgetVisible.reset();
		this.focus();
		this._findWidget!.hide();
	}

	showFindWidget() {
		const activeInstance = this._terminalService.getActiveInstance();
		if (activeInstance && activeInstance.hasSelection() && activeInstance.selection!.indexOf('\n') === -1) {
			this._findWidget!.show(activeInstance.selection);
		} else {
			this._findWidget!.show();
		}
	}

	getFindWidget(): TerminalFindWidget {
		return this._findWidget!;
	}

	focus() {
		if (this._terminalService.connectionState === TerminalConnectionState.Connecting) {
			// If the terminal is waiting to reconnect to remote terminals, then there is no TerminalInstance yet that can
			// be focused. So wait for connection to finish, then focus.
			const activeElement = document.activeElement;
			this._register(this._terminalService.onDidChangeConnectionState(() => {
				// Only focus the terminal if the activeElement has not changed since focus() was called
				// TODO hack
				if (document.activeElement === activeElement) {
					this._focus();
				}
			}));

			return;
		}
		this._focus();
	}

	private _focus() {
		this._terminalService.getActiveInstance()?.focusWhenReady();
	}
}
