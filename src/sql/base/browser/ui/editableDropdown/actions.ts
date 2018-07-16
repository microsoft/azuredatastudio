/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import * as nls from 'vs/nls';

export class ToggleDropdownAction extends Action {
	private static readonly ID = 'dropdownAction.toggle';
	private static readonly LABEL = nls.localize('dropdownAction.toggle', "Toggle dropdown");
	private static readonly ICON = 'dropdown-arrow';

	constructor(private _fn: () => any) {
		super(ToggleDropdownAction.ID, ToggleDropdownAction.LABEL, ToggleDropdownAction.ICON);
	}

	public run(): TPromise<boolean> {
		this._fn();
		return TPromise.as(true);
	}
}
