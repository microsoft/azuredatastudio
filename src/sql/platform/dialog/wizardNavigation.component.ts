/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/wizardNavigation';
import { Component, Inject, forwardRef, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { Event, Emitter } from 'vs/base/common/event';
import { Wizard } from './dialogTypes';

export class WizardNavigationParams implements IBootstrapParams {
	wizard: Wizard;
	navigationHandler: (index: number) => void;
}

@Component({
	selector: 'wizard-navigation',
	providers: [],
	template: `
		<div class="wizardNavigation-container">
			<ng-container *ngFor="let item of _params.wizard.pages; let i = index">
				<div class="wizardNavigation-pageNumber">
					<div class="wizardNavigation-connector" [ngClass]="{'invisible': !hasTopConnector(i), 'active': isActive(i)}"></div>
					<a [attr.href]="isActive(i) ? '' : null" [title]="item.title">
						<span class="wizardNavigation-dot" [ngClass]="{'active': isActive(i)}" (click)="navigate(i)">{{i+1}}</span>
					</a>
					<div class="wizardNavigation-connector" [ngClass]="{'invisible': !hasBottomConnector(i), 'active': isActive(i)}"></div>
				</div>
			</ng-container>
		</div>
	`
})
export class WizardNavigation implements AfterViewInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	public modelViewId: string;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IBootstrapParams) private _params: WizardNavigationParams) {
	}

	ngAfterViewInit() {
		this._params.wizard.onPageChanged(() => this._changeRef.detectChanges());
	}

	hasTopConnector(index: number): boolean {
		return index > 0;
	}

	hasBottomConnector(index: number): boolean {
		return index + 1 !== this._params.wizard.pages.length;
	}

	isActive(index: number): boolean {
		return index <= this._params.wizard.currentPage;
	}

	navigate(index: number): void {
		if (this.isActive(index)) {
			this._params.navigationHandler(index);
		}
	}
}
