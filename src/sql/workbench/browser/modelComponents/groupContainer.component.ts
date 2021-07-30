/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/groupLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import { GroupLayout, GroupContainerProperties, CssStyles } from 'azdata';

import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { endsWith } from 'vs/base/common/strings';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-groupContainer',
	template: `
		<div *ngIf="hasHeader()" [class]="getHeaderClass()" (click)="changeState()" (keydown)="onKeyDown($event)" [tabindex]="isCollapsible()? 0 : -1" [attr.role]="isCollapsible() ? 'button' : null" [attr.aria-expanded]="isCollapsible() ? !collapsed : null">
				{{_containerLayout.header}}
		</div>
		<!-- This extra div is needed so that the expanded state of the header is updated correctly. See https://github.com/microsoft/azuredatastudio/pull/16499 for more details -->
		<div>
			<div #container *ngIf="items" class="modelview-group-container" [ngStyle]="CSSStyles">
				<ng-container *ngFor="let item of items">
				<div class="modelview-group-row" >
					<div  class="modelview-group-cell">
					<model-component-wrapper  [descriptor]="item.descriptor" [modelStore]="modelStore" >
					</model-component-wrapper>
					</div>
				</div>
				</ng-container>
			</div>
		</div>
	`
})
export default class GroupContainer extends ContainerBase<GroupLayout, GroupContainerProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _containerLayout: GroupLayout;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	onKeyDown(event: KeyboardEvent): void {
		let e = new StandardKeyboardEvent(event);
		if (e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space) {
			this.changeState();
			DOM.EventHelper.stop(e, true);
		}
		else if (e.keyCode === KeyCode.LeftArrow) {
			if (!this.collapsed) {
				this.changeState();
			}
			DOM.EventHelper.stop(e, true);
		} else if (e.keyCode === KeyCode.RightArrow) {
			if (this.collapsed) {
				this.changeState();
			}
			DOM.EventHelper.stop(e, true);
		}
	}

	/// IComponent implementation

	public setLayout(layout: GroupLayout): void {
		this._containerLayout = layout;
		this.collapsed = !!layout.collapsed;
		this.layout();
	}

	public set collapsed(newValue: boolean) {
		this.setPropertyFromUI<boolean>((properties, value) => { properties.collapsed = value; }, newValue);
	}

	public get collapsed(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.collapsed, false);
	}

	private hasHeader(): boolean {
		return this._containerLayout && !!this._containerLayout.header;
	}

	private isCollapsible(): boolean {
		return this.hasHeader() && this._containerLayout.collapsible === true;
	}

	public getContainerWidth(): string {
		if (this._containerLayout && this._containerLayout.width) {
			let width: string = this._containerLayout.width.toString();
			if (!endsWith(width, '%') && !endsWith(width.toLowerCase(), 'px')) {
				width = width + 'px';
			}
			return width;
		} else {
			return '100%';
		}
	}

	public getContainerDisplayStyle(): string {
		return !this.isCollapsible() || !this.collapsed ? 'block' : 'none';
	}

	public getHeaderClass(): string {
		if (this.isCollapsible()) {
			let modifier = this.collapsed ? 'collapsed' : 'expanded';
			return `modelview-group-header-collapsible ${modifier}`;
		} else {
			return 'modelview-group-header';
		}
	}

	public changeState(): void {
		if (this.isCollapsible()) {
			this.collapsed = !this.collapsed;
			this._changeRef.detectChanges();
		}
	}

	public override get CSSStyles(): CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'display': this.getContainerDisplayStyle(),
			'width': this.getContainerWidth(),
		});
	}
}
