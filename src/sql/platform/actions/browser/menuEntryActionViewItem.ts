/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { asCSSUrl, createCSSRule } from 'vs/base/browser/dom';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { IDisposable, toDisposable, dispose } from 'vs/base/common/lifecycle';
import { ICommandAction, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

const ids = new IdGenerator('menu-item-action-item-icon-');

const ICON_PATH_TO_CSS_RULES = new Map<string /* path*/, string /* CSS rule */>();

/**
 * Always show label for action items, instead of whether they don't have
 * an icon/CSS class. Useful for some toolbar scenarios in particular with
 * contributed actions from other extensions
 */
export class LabeledMenuItemActionItem extends MenuEntryActionViewItem {
	private _labeledItemClassDispose?: IDisposable;

	constructor(
		_action: MenuItemAction,
		@IKeybindingService labeledkeybindingService: IKeybindingService,
		@INotificationService _notificationService: INotificationService,
		@IContextKeyService _contextKeyService: IContextKeyService,
		private readonly _defaultCSSClassToAdd: string = ''
	) {
		super(_action, undefined, labeledkeybindingService, _notificationService, _contextKeyService);
	}

	override updateLabel(): void {
		if (this.label) {
			this.label.innerText = this._commandAction.label;
		}
	}

	// Overwrite item class to ensure that we can pass in a CSS class that other items use
	// Leverages the _defaultCSSClassToAdd property that's passed into the constructor
	protected override _updateItemClass(item: ICommandAction): void {
		dispose(this._labeledItemClassDispose);
		this._labeledItemClassDispose = undefined;

		if (ThemeIcon.isThemeIcon(item.icon)) {
			// TODO
		} else if (item.icon) {
			let iconClass: string;


			if (item.icon?.dark?.scheme) {
				const iconPathMapKey = item.icon.dark.toString();

				if (ICON_PATH_TO_CSS_RULES.has(iconPathMapKey)) {
					iconClass = ICON_PATH_TO_CSS_RULES.get(iconPathMapKey)!;
				} else {
					iconClass = ids.nextId();
					createCSSRule(`.codicon.${iconClass}`, `background-image: ${asCSSUrl(item.icon.light || item.icon.dark)} !important`);
					createCSSRule(`.vs-dark .codicon.${iconClass}, .hc-black .codicon.${iconClass}`, `background-image: ${asCSSUrl(item.icon.dark)} !important`);
					ICON_PATH_TO_CSS_RULES.set(iconPathMapKey, iconClass);
				}

				if (this.label) {
					const iconClasses = iconClass.split(' ');
					if (this._defaultCSSClassToAdd) {
						iconClasses.push(this._defaultCSSClassToAdd);
					}
					this.label.classList.add('codicon', ...iconClasses);
					this._labeledItemClassDispose = toDisposable(() => {
						if (this.label) {
							this.label.classList.remove('codicon', ...iconClasses);
						}
					});
				}
			}
		}
	}

	override dispose(): void {
		if (this._labeledItemClassDispose) {
			dispose(this._labeledItemClassDispose);
			this._labeledItemClassDispose = undefined;
		}

		super.dispose();
	}
}

/**
 * This is a duplicate of LabeledMenuItemActionItem with the following exceptions:
 * - Adds CSS class: `masked-icon` to contributed actions label element.
 * - Adds style rule for masked-icon.
 */
export class MaskedLabeledMenuItemActionItem extends MenuEntryActionViewItem {
	private _labeledItemClassDispose?: IDisposable;

	constructor(
		action: MenuItemAction,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		private readonly _defaultCSSClassToAdd: string = ''
	) {
		super(action, undefined, keybindingService, notificationService, contextKeyService);
	}

	override updateLabel(): void {
		if (this.label) {
			this.label.innerText = this._commandAction.label;
		}
	}

	// Overwrite item class to ensure that we can pass in a CSS class that other items use
	// Leverages the _defaultCSSClassToAdd property that's passed into the constructor
	protected override _updateItemClass(item: ICommandAction): void {
		dispose(this._labeledItemClassDispose);
		this._labeledItemClassDispose = undefined;

		if (ThemeIcon.isThemeIcon(item.icon)) {
			// TODO
		} else if (item.icon) {
			let iconClass: string;


			if (item.icon?.dark?.scheme) {
				const iconPathMapKey = item.icon.dark.toString();

				if (ICON_PATH_TO_CSS_RULES.has(iconPathMapKey)) {
					iconClass = ICON_PATH_TO_CSS_RULES.get(iconPathMapKey)!;
				} else {
					iconClass = ids.nextId();
					createCSSRule(`.codicon.masked-icon.${iconClass}::before`, `-webkit-mask-image: ${asCSSUrl(item.icon.light || item.icon.dark)}`);
					createCSSRule(`.codicon.masked-icon.${iconClass}::before`, `mask-image: ${asCSSUrl(item.icon.light || item.icon.dark)}`);
					ICON_PATH_TO_CSS_RULES.set(iconPathMapKey, iconClass);
				}

				if (this.label) {
					const iconClasses = iconClass.split(' ');
					if (this._defaultCSSClassToAdd) {
						iconClasses.push(this._defaultCSSClassToAdd);
					}
					this.label.classList.add('codicon', ...iconClasses);
					this.label.classList.add('masked-icon', ...iconClasses);
					this._labeledItemClassDispose = toDisposable(() => {
						if (this.label) {
							this.label.classList.remove('codicon', ...iconClasses);
						}
					});
				}
			}
		}
	}

	override dispose(): void {
		if (this._labeledItemClassDispose) {
			dispose(this._labeledItemClassDispose);
			this._labeledItemClassDispose = undefined;
		}

		super.dispose();
	}
}
