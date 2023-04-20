/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { reset } from 'vs/base/browser/dom';
import { IHoverDelegate } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { renderIcon } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { IAction, WorkbenchActionExecutedClassification, WorkbenchActionExecutedEvent } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { assertType } from 'vs/base/common/types';
import { localize } from 'vs/nls';
import { createActionViewItem, createAndFillInContextMenuActions, MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { Action2, IMenuService, MenuId, MenuItemAction, registerAction2 } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { WindowTitle } from 'vs/workbench/browser/parts/titlebar/windowTitle';
import { MENUBAR_SELECTION_BACKGROUND, MENUBAR_SELECTION_FOREGROUND, PANEL_BORDER, TITLE_BAR_ACTIVE_FOREGROUND } from 'vs/workbench/common/theme';

export class CommandCenterControl {

	private readonly _disposables = new DisposableStore();

	private readonly _onDidChangeVisibility = new Emitter<void>();
	readonly onDidChangeVisibility: Event<void> = this._onDidChangeVisibility.event;

	readonly element: HTMLElement = document.createElement('div');

	constructor(
		windowTitle: WindowTitle,
		hoverDelegate: IHoverDelegate,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IMenuService menuService: IMenuService,
		@IQuickInputService quickInputService: IQuickInputService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		this.element.classList.add('command-center');

		const titleToolbar = new ToolBar(this.element, contextMenuService, {
			actionViewItemProvider: (action) => {

				if (action instanceof MenuItemAction && action.id === 'workbench.action.quickOpen') {

					class InputLikeViewItem extends MenuEntryActionViewItem {

						private readonly workspaceTitle = document.createElement('span');

						override render(container: HTMLElement): void {
							super.render(container);
							container.classList.add('quickopen', 'left');

							assertType(this.label);
							this.label.classList.add('search');

							const searchIcon = renderIcon(Codicon.search);
							searchIcon.classList.add('search-icon');

							this.workspaceTitle.classList.add('search-label');
							this.updateTooltip();
							reset(this.label, searchIcon, this.workspaceTitle);
							// this._renderAllQuickPickItem(container);

							this._store.add(windowTitle.onDidChange(this.updateTooltip, this));
						}

						override getTooltip() {
							// label: just workspace name and optional decorations
							const { prefix, suffix } = windowTitle.getTitleDecorations();
							let label = windowTitle.workspaceName;
							if (!label) {
								label = localize('label.dfl', "Search");
							}
							if (prefix) {
								label = localize('label1', "{0} {1}", prefix, label);
							}
							if (suffix) {
								label = localize('label2', "{0} {1}", label, suffix);
							}
							this.workspaceTitle.innerText = label;

							// tooltip: full windowTitle
							const kb = keybindingService.lookupKeybinding(action.id)?.getLabel();
							const title = kb
								? localize('title', "Search {0} ({1}) \u2014 {2}", windowTitle.workspaceName, kb, windowTitle.value)
								: localize('title2', "Search {0} \u2014 {1}", windowTitle.workspaceName, windowTitle.value);

							return title;
						}
					}
					return instantiationService.createInstance(InputLikeViewItem, action, { hoverDelegate });

				} else if (action instanceof MenuItemAction && action.id === 'commandCenter.help') {

					class ExtraClass extends MenuEntryActionViewItem {
						override render(container: HTMLElement): void {
							super.render(container);
							container.classList.add('quickopen', 'right');
						}
					}

					return instantiationService.createInstance(ExtraClass, action, { hoverDelegate });

				} else {
					return createActionViewItem(instantiationService, action, { hoverDelegate });
				}
			},
			allowContextMenu: true
		});
		const menu = this._disposables.add(menuService.createMenu(MenuId.CommandCenter, contextKeyService));
		const menuDisposables = this._disposables.add(new DisposableStore());
		const menuUpdater = () => {
			menuDisposables.clear();
			const actions: IAction[] = [];
			menuDisposables.add(createAndFillInContextMenuActions(menu, undefined, actions));
			titleToolbar.setActions(actions);
		};
		menuUpdater();
		this._disposables.add(menu.onDidChange(menuUpdater));
		this._disposables.add(keybindingService.onDidUpdateKeybindings(() => {
			menuUpdater();
		}));
		this._disposables.add(quickInputService.onShow(this._setVisibility.bind(this, false)));
		this._disposables.add(quickInputService.onHide(this._setVisibility.bind(this, true)));

		titleToolbar.actionRunner.onDidRun(e => {
			telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: e.action.id, from: 'commandCenter' });
		});
	}

	private _setVisibility(show: boolean): void {
		this.element.classList.toggle('hide', !show);
		this._onDidChangeVisibility.fire();
	}

	dispose(): void {
		this._disposables.dispose();
	}
}

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'commandCenter.help',
			title: localize('all', "Show Search Modes..."),
			icon: Codicon.chevronDown,
			menu: { id: MenuId.CommandCenter, order: 101 }
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IQuickInputService).quickAccess.show('?');
	}
});

// --- theme colors

// foreground (inactive and active)
colors.registerColor(
	'commandCenter.foreground',
	{ dark: TITLE_BAR_ACTIVE_FOREGROUND, hcDark: TITLE_BAR_ACTIVE_FOREGROUND, light: TITLE_BAR_ACTIVE_FOREGROUND, hcLight: TITLE_BAR_ACTIVE_FOREGROUND },
	localize('commandCenter-foreground', "Foreground color of the command center"),
	false
);
colors.registerColor(
	'commandCenter.activeForeground',
	{ dark: MENUBAR_SELECTION_FOREGROUND, hcDark: MENUBAR_SELECTION_FOREGROUND, light: MENUBAR_SELECTION_FOREGROUND, hcLight: MENUBAR_SELECTION_FOREGROUND },
	localize('commandCenter-activeForeground', "Active foreground color of the command center"),
	false
);
// background (inactive and active)
colors.registerColor(
	'commandCenter.background',
	{ dark: null, hcDark: null, light: null, hcLight: null },
	localize('commandCenter-background', "Background color of the command center"),
	false
);
colors.registerColor(
	'commandCenter.activeBackground',
	{ dark: MENUBAR_SELECTION_BACKGROUND, hcDark: MENUBAR_SELECTION_BACKGROUND, light: MENUBAR_SELECTION_BACKGROUND, hcLight: MENUBAR_SELECTION_BACKGROUND },
	localize('commandCenter-activeBackground', "Active background color of the command center"),
	false
);
// border: defaults to active background
colors.registerColor(
	'commandCenter.border', { dark: PANEL_BORDER, hcDark: PANEL_BORDER, light: PANEL_BORDER, hcLight: PANEL_BORDER },
	localize('commandCenter-border', "Border color of the command center"),
	false
);
