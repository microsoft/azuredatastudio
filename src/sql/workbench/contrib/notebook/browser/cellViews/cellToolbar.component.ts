/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import { Component } from '@angular/core';
import { localize } from 'vs/nls';

const ButtonEdit = localize('buttonEdit', "Edit");
const ButtonClose = localize('buttonClose', "Close");
const ButtonAdd = localize('buttonAdd', "Add new cell");
const ButtonMoveDown = localize('buttonMoveDown', "Move cell down");
const ButtonMoveUp = localize('buttonMoveUp', "Move cell up");
const ButtonDelete = localize('buttonDelete', "Delete cell");

@Component({
	selector: 'cell-toolbar-component',
	template: `
		<ul class="cell-toolbar">
			<li><a class="cell-tool-edit" role="button" href="#" (click)="toolbarToggleEditMode()"><span class="offscreen">${ButtonEdit}</span></a></li>
			<li><a class="cell-tool-close" role="button" href="#" (click)="toolbarUnselectActiveCell()"><span class="offscreen">${ButtonClose}</span></a></li>
			<li><a class="cell-tool-add" role="button" href="#"><span class="offscreen">${ButtonAdd}</span></a></li>
			<li><a class="cell-tool-move-down" role="button" href="#"><span class="offscreen">${ButtonMoveDown}</span></a></li>
			<li><a class="cell-tool-move-up" role="button" href="#"><span class="offscreen">${ButtonMoveUp}</span></a></li>
			<li><a class="cell-tool-delete" role="button" href="#"><span class="offscreen">${ButtonDelete}</span></a></li>
			<li><div #moreactions class="cell-tool-more"></div></li>
		</ul>
	`
})
export class CellToolbar {
	ngOnInit() {
	}
}
