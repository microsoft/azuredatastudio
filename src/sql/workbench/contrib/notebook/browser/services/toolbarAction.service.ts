/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Injectable } from '@angular/core';
import { IToolbarActionService } from 'sql/workbench/services/notebook/common/interfaces';
import { Event, Emitter } from 'vs/base/common/event';

@Injectable()
export class ToolbarActionService implements IToolbarActionService {
	_toolbarItem: undefined;

	private _onToolbarItemSelect = new Emitter<string>();
	public onToolbarItemSelect: Event<string> = this._onToolbarItemSelect.event;

	public fireOnToolbarItemSelect(toolbarItem: string): void {
		this._onToolbarItemSelect.fire(toolbarItem);
	}
}
