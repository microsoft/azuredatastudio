/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import * as DOM from 'vs/base/browser/dom';
import { MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { MenuItemAction } from 'vs/platform/actions/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';

export class CodiconActionViewItem extends MenuEntryActionViewItem {
	constructor(
		_action: MenuItemAction,
		keybindingService: IKeybindingService,
		notificationService: INotificationService,
	) {
		super(_action, keybindingService, notificationService);
	}
	override updateLabel(): void {
		if (this.options.label && this.label) {
			DOM.reset(this.label, ...renderLabelWithIcons(this._commandAction.label ?? ''));
		}
	}
}

export class ActionViewWithLabel extends MenuEntryActionViewItem {
	private _actionLabel?: HTMLAnchorElement;

	constructor(
		_action: MenuItemAction,
		keybindingService: IKeybindingService,
		notificationService: INotificationService,
	) {
		super(_action, keybindingService, notificationService);
	}

	override render(container: HTMLElement): void {
		super.render(container);
		container.classList.add('notebook-action-view-item');
		this._actionLabel = document.createElement('a');
		container.appendChild(this._actionLabel);
		this.updateLabel();
	}

	override updateLabel() {
		if (this._actionLabel) {
			this._actionLabel.classList.add('notebook-label');
			this._actionLabel.innerText = this._action.label;
			this._actionLabel.title = this._action.tooltip.length ? this._action.tooltip : this._action.label;
		}
	}
}
