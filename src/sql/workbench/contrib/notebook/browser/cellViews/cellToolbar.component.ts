/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';

import { Component } from '@angular/core';
import { localize } from 'vs/nls';

export const CELL_TOOLBAR_SELECTOR: string = 'cell-toolbar-component';

@Component({
	selector: CELL_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./cellToolbar.component.html'))
})
export class CellToolbarComponent {
	public buttonEdit = localize('buttonEdit', "Edit");
	public buttonClose = localize('buttonClose', "Close");
	public buttonAdd = localize('buttonAdd', "Add new cell");
	public buttonMoveDown = localize('buttonMoveDown', "Move cell down");
	public buttonMoveUp = localize('buttonMoveUp', "Move cell up");
	public buttonDelete = localize('buttonDelete', "Delete cell");

	constructor() {
	}
}
