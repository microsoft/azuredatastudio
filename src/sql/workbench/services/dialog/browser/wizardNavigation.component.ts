/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/wizardNavigation';
import { Component, Inject, forwardRef, ElementRef, AfterViewInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Event, Emitter } from 'vs/base/common/event';
import { Wizard, WizardPage } from '../common/dialogTypes';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';

export class WizardNavigationParams implements IBootstrapParams {
	wizard!: Wizard;
	navigationHandler!: (index: number) => void;
}

@Component({
	selector: WizardNavigation.SELECTOR,
	providers: [],
	template: `
		<div #container class="wizardNavigation-container">
			<ng-container *ngFor="let item of _params.wizard.pages; let i = index">
				<div class="wizardNavigation-pageNumber">
					<div class="wizardNavigation-connector" [ngClass]="{'invisible': !hasTopConnector(i), 'active': isActive(i)}"></div>
					<a [tabindex]="isActive(i) ? 0 : -1" [attr.href]="isActive(i) ? '' : null" [title]="item.title" [attr.aria-label]="getStepAriaLabel(i, item)" (click)="navigate(i)" (keydown)="onKey($event,i)" [attr.aria-current]="isCurrentPage(i) ? 'step' : null" [attr.aria-disabled]="isActive(i) ? null : 'true'">
						<span class="wizardNavigation-dot" [ngClass]="{'active': isActive(i), 'currentPage': isCurrentPage(i)}">{{i+1}}</span>
					</a>
					<div class="wizardNavigation-connector" [ngClass]="{'invisible': !hasBottomConnector(i), 'active': isActive(i)}"></div>
				</div>
			</ng-container>
		</div>
	`
})
export class WizardNavigation implements AfterViewInit {
	public static readonly SELECTOR = 'wizard-navigation';

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild('container', { read: ElementRef }) private _container!: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IBootstrapParams) private _params: WizardNavigationParams,
		@Inject(IWorkbenchThemeService) private _themeService: IWorkbenchThemeService) {
	}

	ngAfterViewInit() {
		this._themeService.onDidColorThemeChange(() => this.style());
		this.style();
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

	isCurrentPage(index: number): boolean {
		return index === this._params.wizard.currentPage;
	}

	navigate(index: number): void {
		if (this.isActive(index)) {
			this._params.navigationHandler(index);
		}
	}

	onKey(e: KeyboardEvent, index: number): void {
		const event = new StandardKeyboardEvent(e);
		if (event.equals(KeyCode.Space) || event.equals(KeyCode.Enter)) {
			this.navigate(index);
			e.preventDefault();
			e.stopPropagation();
		}
	}

	getStepAriaLabel(index: number, item: WizardPage): string {
		return localize({
			key: 'wizardNavigation.stepName',
			comment: ['Name of a step in wizard. {0}: step number, {1}: step name.']
		}, "Step {0}: {1}", index + 1, item.title);
	}

	private style(): void {
		let theme = this._themeService.getColorTheme();
		let navigationBackgroundColor = theme.getColor(SIDE_BAR_BACKGROUND);
		if (!navigationBackgroundColor) {
			return;
		}
		if (theme.type === 'light') {
			navigationBackgroundColor = navigationBackgroundColor.lighten(0.03);
		} else if (theme.type === 'dark') {
			navigationBackgroundColor = navigationBackgroundColor.darken(0.03);
		}
		(this._container.nativeElement as HTMLElement).style.backgroundColor = navigationBackgroundColor.toString();
	}
}
