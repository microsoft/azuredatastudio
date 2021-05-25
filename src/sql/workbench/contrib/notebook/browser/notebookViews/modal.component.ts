/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Input } from '@angular/core';

@Component({
	selector: 'views-modal-component',
	template: `
		<div [class.modal]="modal">
			<div class="content">
				<div class="title">{{title}}</div>
				<ng-content></ng-content>
			</div>
		</div>
	`
})
export class ModalComponent {
	@Input() title: boolean;
}
