/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { LabeledMenuItemActionItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';

export class NoContextLabeledMenuItemActionItem extends LabeledMenuItemActionItem {

	constructor(
		action: MenuItemAction,
		@IKeybindingService labeledkeybindingService: IKeybindingService,
		@IContextMenuService labeledcontextMenuService: IContextMenuService,
		@INotificationService notificationService: INotificationService,
		defaultCSSClassToAdd: string = ''
	) {
		super(action, labeledkeybindingService, labeledcontextMenuService, notificationService, defaultCSSClassToAdd);
		super.setActionContext(undefined);
	}

	public setActionContext(context: any): void {
		// No-op
	}
}
