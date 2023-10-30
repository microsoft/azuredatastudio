/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dialogModal';
import { Component, ViewChild, Inject, forwardRef, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ModelViewContent } from 'sql/workbench/browser/modelComponents/modelViewContent.component';
import { DialogPane } from 'sql/workbench/services/dialog/browser/dialogPane';
import { Event, Emitter } from 'vs/base/common/event';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { getFocusableElements } from 'sql/base/browser/dom';

export interface LayoutRequestParams {
	modelViewId?: string;
	alwaysRefresh?: boolean;
}
export interface DialogComponentParams extends IBootstrapParams {
	modelViewId: string;
	validityChangedCallback: (valid: boolean) => void;
	onLayoutRequested: Event<LayoutRequestParams>;
	dialogPane: DialogPane;
	setInitialFocus: boolean;
}

@Component({
	selector: 'dialog-modelview-container',
	providers: [],
	template: `
		<div class="dialogContainer" *ngIf="_dialogPane && _dialogPane.displayPageTitle">
			<div class="dialogModal-wizardHeader" *ngIf="_dialogPane && _dialogPane.displayPageTitle">
				<h2 *ngIf="_dialogPane.pageNumber" class="wizardPageTitle">{{_dialogPane.pageNumberDisplayText}}: {{_dialogPane.title}}</h2>
				<h2 *ngIf="!_dialogPane.pageNumber" class="wizardPageTitle">{{_dialogPane.title}}</h2>
				<div *ngIf="_dialogPane.description">{{_dialogPane.description}}</div>
			</div>
			<div style="flex: 1 1 auto; position: relative;">
				<modelview-content [modelViewId]="modelViewId" style="width: 100%; height: 100%; position: absolute;">
				</modelview-content>
			</div>
		</div>
		<modelview-content [modelViewId]="modelViewId" *ngIf="!_dialogPane || !_dialogPane.displayPageTitle">
		</modelview-content>
	`
})
export class DialogContainer implements AfterViewInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	public _dialogPane: DialogPane;

	public modelViewId: string;
	@ViewChild(ModelViewContent) private _modelViewContent!: ModelViewContent;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IBootstrapParams) private _params: DialogComponentParams) {
		this.modelViewId = this._params.modelViewId;
		this._params.onLayoutRequested(layoutParams => {
			if (layoutParams && (layoutParams.alwaysRefresh || layoutParams.modelViewId === this.modelViewId)) {
				this.layout();
			}
		});
		this._dialogPane = this._params.dialogPane;
	}

	ngAfterViewInit(): void {
		const element = <HTMLElement>this._el.nativeElement;
		this._modelViewContent.onEvent(event => {
			if (event.isRootComponent && event.eventType === ComponentEventType.validityChanged) {
				this._params.validityChangedCallback(event.args);
			}

			// Set focus to the first focusable elements when the content is loaded and the focus is not currently inside the content area
			if (this._params.setInitialFocus && event.isRootComponent && event.eventType === ComponentEventType.onComponentLoaded && !element.contains(document.activeElement)) {
				const focusableElements = getFocusableElements(element);
				if (focusableElements?.length > 0) {
					focusableElements[0].focus();
				}
			}
		});
		element.style.height = '100%';
		element.style.width = '100%';
	}

	public layout(): void {
		this._modelViewContent.layout();
		this._changeRef.detectChanges();
	}
}
