/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/accountListStatusbarItem';
import { Action, IAction } from 'vs/base/common/actions';
import { IDisposable } from 'vs/base/common/lifecycle';
import { $, append } from 'vs/base/browser/dom';
import { onUnexpectedError } from 'vs/base/common/errors';
import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { Themable, STATUS_BAR_FOREGROUND } from 'vs/workbench/common/theme';
import { IThemeService } from 'vs/platform/theme/common/themeService';

import { IAccountManagementService } from 'sql/platform/accountManagement/common/interfaces';

export class AccountListStatusbarItem extends Themable implements IStatusbarItem {
	private _manageLinkedAccountAction: IAction;
	private _icon: HTMLElement;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@IThemeService themeService: IThemeService
	) {
		super(themeService);
	}

	protected updateStyles(): void {
		super.updateStyles();
		if (this._icon) {
			this._icon.style.backgroundColor = this.getColor(STATUS_BAR_FOREGROUND);
		}
	}

	public render(container: HTMLElement): IDisposable {
		// Create root element for account list
		const rootElement = append(container, $('.linked-account-staus'));
		const accountElement = append(rootElement, $('a.linked-account-status-selection'));
		accountElement.title = ManageLinkedAccountAction.LABEL;
		accountElement.onclick = () => this._onClick();
		this._icon = append(accountElement, $('.linked-account-icon'));

		this.updateStyles();

		return this;
	}

	private _onClick() {
		if (!this._manageLinkedAccountAction) {
			this._manageLinkedAccountAction = this._instantiationService.createInstance(ManageLinkedAccountAction, ManageLinkedAccountAction.ID, ManageLinkedAccountAction.LABEL);
		}
		this._manageLinkedAccountAction.run().then(null, onUnexpectedError);
	}
}

export class ManageLinkedAccountAction extends Action {
	public static ID = 'sql.action.accounts.manageLinkedAccount';
	public static LABEL = localize('manageLinedAccounts', 'Manage Linked Accounts');

	constructor(id: string, label: string,
		@IAccountManagementService protected _accountManagementService: IAccountManagementService) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return new TPromise<any>(() => this._accountManagementService.openAccountListDialog());
	}
}
