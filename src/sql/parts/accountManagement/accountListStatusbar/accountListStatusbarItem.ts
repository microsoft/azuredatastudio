/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/accountListStatusbarItem';
import { Action, IAction } from 'vs/base/common/actions';
import { combinedDisposable, IDisposable } from 'vs/base/common/lifecycle';
import { $, append } from 'vs/base/browser/dom';
import { onUnexpectedError } from 'vs/base/common/errors';
import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';

import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';

export class AccountListStatusbarItem implements IStatusbarItem {
	private _rootElement: HTMLElement;
	private _iconElement: HTMLElement;
	private _toDispose: IDisposable[];
	private _manageLinkedAccountAction: IAction;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		this._toDispose = [];
	}

	public render(container: HTMLElement): IDisposable {
		// Create root element for account list
		this._rootElement = append(container, $('.linked-account-staus'));
		this._rootElement.title = ManageLinkedAccountAction.LABEL;
		this._rootElement.onclick = () => this._onClick();

		this._iconElement = append(this._rootElement, $('a.linked-account-status-selection'));

		return combinedDisposable(this._toDispose);
	}

	private _onClick() {
		if (!this._manageLinkedAccountAction) {
			this._manageLinkedAccountAction = this._instantiationService.createInstance(ManageLinkedAccountAction, ManageLinkedAccountAction.ID, ManageLinkedAccountAction.LABEL);
		}
		this._manageLinkedAccountAction.run().done(null, onUnexpectedError);
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
