/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./buttonMenu';
import { IAction, IActionRunner, IActionViewItemProvider } from 'vs/base/common/actions';
import { IDisposable } from 'vs/base/common/lifecycle';
import { AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { append, $, addClasses } from 'vs/base/browser/dom';
import { IDropdownMenuOptions, DropdownMenu, IActionProvider, ILabelRenderer } from 'vs/base/browser/ui/dropdown/dropdown';
import { IContextMenuProvider } from 'vs/base/browser/contextmenu';
import { BaseActionViewItem } from 'vs/base/browser/ui/actionbar/actionViewItems';

export class DropdownMenuActionViewItem extends BaseActionViewItem {
	private menuActionsOrProvider: ReadonlyArray<IAction> | IActionProvider;
	private dropdownMenu: DropdownMenu | undefined;
	private menuLabel?: string | undefined;
	private contextMenuProvider: IContextMenuProvider;
	private actionViewItemProvider?: IActionViewItemProvider;
	private keybindings?: (action: IAction) => ResolvedKeybinding | undefined;
	private cssClass: string | undefined;
	private anchorAlignmentProvider: (() => AnchorAlignment) | undefined;

	constructor(
		action: IAction,
		menuActionsOrProvider: ReadonlyArray<IAction> | IActionProvider,
		contextMenuProvider: IContextMenuProvider,
		actionViewItemProvider: IActionViewItemProvider | undefined,
		actionRunner: IActionRunner,
		keybindings: ((action: IAction) => ResolvedKeybinding | undefined) | undefined,
		cssClass: string | undefined,
		menuLabel: string | undefined,
		anchorAlignmentProvider?: () => AnchorAlignment) {

		super(null, action);

		this.menuActionsOrProvider = menuActionsOrProvider;
		this.contextMenuProvider = contextMenuProvider;
		this.actionViewItemProvider = actionViewItemProvider;
		this.actionRunner = actionRunner;
		this.keybindings = keybindings;
		this.cssClass = cssClass;
		this.menuLabel = menuLabel;
		this.anchorAlignmentProvider = anchorAlignmentProvider;
	}

	render(container: HTMLElement): void {
		const labelRenderer: ILabelRenderer = (el: HTMLElement): IDisposable | null => {
			this.element = append(el, $('a.action-label.button-menu'));
			if (this.cssClass) {
				addClasses(this.element, this.cssClass);
			}
			if (this.menuLabel) {
				this.element.innerText = this.menuLabel;
			}

			this.element.tabIndex = 0;
			this.element.setAttribute('role', 'button');
			this.element.setAttribute('aria-haspopup', 'true');
			this.element.title = this._action.label || '';

			return null;
		};

		const options: IDropdownMenuOptions = {
			contextMenuProvider: this.contextMenuProvider,
			labelRenderer: labelRenderer
		};

		// Render the DropdownMenu around a simple action to toggle it
		if (Array.isArray(this.menuActionsOrProvider)) {
			options.actions = this.menuActionsOrProvider;
		} else {
			options.actionProvider = this.menuActionsOrProvider as IActionProvider;
		}

		this.dropdownMenu = this._register(new DropdownMenu(container, options));
		this.dropdownMenu.menuOptions = {
			actionViewItemProvider: this.actionViewItemProvider,
			actionRunner: this.actionRunner,
			getKeyBinding: this.keybindings,
			context: this._context
		};

		if (this.anchorAlignmentProvider) {
			const that = this;

			this.dropdownMenu.menuOptions = {
				...this.dropdownMenu.menuOptions,
				get anchorAlignment(): AnchorAlignment {
					return that.anchorAlignmentProvider!();
				}
			};
		}
	}

	setActionContext(newContext: unknown): void {
		super.setActionContext(newContext);

		if (this.dropdownMenu) {
			if (this.dropdownMenu.menuOptions) {
				this.dropdownMenu.menuOptions.context = newContext;
			} else {
				this.dropdownMenu.menuOptions = { context: newContext };
			}
		}
	}

	show(): void {
		this.dropdownMenu?.show();
	}
}
