/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Component, Inject, forwardRef, ElementRef } from '@angular/core';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { DialogContainer, DialogComponentParams } from 'sql/platform/dialog/dialogContainer.component';

@Component({
	selector: 'wizard-modelview-container',
	providers: [],
	template: `
		<div class="dialogContainer" *ngIf="_dialogPane && _dialogPane.displayPageTitle">
			<div class="dialogModal-wizardHeader">
				<div *ngIf="_dialogPane.pageNumber" class="wizardPageNumber">Step {{_dialogPane.pageNumber}}</div>
				<h1 class="wizardPageTitle">{{_dialogPane.title}}</h1>
				<div *ngIf="_dialogPane.description">{{_dialogPane.description}}</div>
			</div>
			<modelview-content [modelViewId]="modelViewId">
			</modelview-content>
		</div>
	`
})
export class WizardPageContainer extends DialogContainer {
	private _dialogPane: DialogPane;

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IBootstrapParams) params: DialogComponentParams) {
		super(el, params);
		this._dialogPane = params.dialogPane;
	}
}
