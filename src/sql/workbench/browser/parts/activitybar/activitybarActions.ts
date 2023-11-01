/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { EventType as TouchEventType, GestureEvent } from 'vs/base/browser/touch';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IMenuService } from 'vs/platform/actions/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IColorTheme, IThemeService } from 'vs/platform/theme/common/themeService';
import { ActivityAction, ActivityActionViewItem, IActivityHoverOptions, ICompositeBarColors } from 'vs/workbench/browser/parts/compositeBarActions';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';

export class AccountsActionViewItem extends ActivityActionViewItem {
	constructor(
		action: ActivityAction,
		colors: (theme: IColorTheme) => ICompositeBarColors,
		hoverOptions: IActivityHoverOptions,
		@IThemeService themeService: IThemeService,
		@IContextMenuService protected contextMenuService: IContextMenuService,
		@IMenuService protected menuService: IMenuService,
		@IAccountManagementService private readonly accountManagementService: IAccountManagementService,
		@IHoverService hoverService: IHoverService,
		@IConfigurationService configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService,
	) {
		super(action, { draggable: false, colors, icon: true, hoverOptions: hoverOptions },
			(/*badgesEnabledForCompositeId*/) => false, themeService, hoverService, configurationService, keybindingService);
	}

	override render(container: HTMLElement): void {
		super.render(container);

		// Context menus are triggered on mouse down so that an item can be picked
		// and executed with releasing the mouse over it

		this._register(DOM.addDisposableListener(this.container, DOM.EventType.MOUSE_DOWN, (e: MouseEvent) => {
			DOM.EventHelper.stop(e, true);
			this.accountManagementService.openAccountListDialog();
		}));

		this._register(DOM.addDisposableListener(this.container, DOM.EventType.KEY_UP, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				DOM.EventHelper.stop(e, true);
				this.accountManagementService.openAccountListDialog();
			}
		}));

		this._register(DOM.addDisposableListener(this.container, TouchEventType.Tap, (e: GestureEvent) => {
			DOM.EventHelper.stop(e, true);
			this.accountManagementService.openAccountListDialog();
		}));
	}
}
