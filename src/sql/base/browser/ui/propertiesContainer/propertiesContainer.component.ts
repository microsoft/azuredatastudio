/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/propertiesContainer';
import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { TogglePropertiesAction } from 'sql/base/browser/ui/propertiesContainer/togglePropertiesAction';

enum GridDisplayLayout {
	twoColumns = 'twoColumns',
	oneColumn = 'oneColumn'
}

enum PropertyLayoutDirection {
	row = 'rowLayout',
	column = 'columnLayout'
}

export interface PropertyItem {
	displayName: string;
	value: string;
}

@Component({
	selector: 'properties-container',
	templateUrl: decodeURI(require.toUrl('./propertiesContainer.component.html'))
})
export class PropertiesContainer extends Disposable implements OnInit, OnDestroy, AfterViewInit {
	public gridDisplayLayout = GridDisplayLayout.twoColumns;
	public propertyLayout = PropertyLayoutDirection.row;
	private _propertyItems: PropertyItem[] = [];
	private _showToggleButton: boolean = false;
	private _actionbar: ActionBar;
	private _togglePropertiesAction: TogglePropertiesAction = new TogglePropertiesAction();
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngAfterViewInit(): void {
		this._togglePropertiesAction.onDidChange((e) => {
			if (e.expanded !== undefined) {
				this._changeRef.detectChanges();
			}
		});
		this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
		this._actionbar.push(this._togglePropertiesAction, { icon: true, label: false });
	}

	ngOnInit() {
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, () => this.layoutPropertyItems()));
		this._changeRef.detectChanges();
	}

	ngOnDestroy() {
		this.dispose();
	}

	private layoutPropertyItems(): void {
		// Reflow:
		// 2 columns w/ horizontal alignment : 1366px and above
		// 2 columns w/ vertical alignment : 1024 - 1365px
		// 1 column w/ vertical alignment : 1024px or less
		if (window.innerWidth >= 1366) {
			this.gridDisplayLayout = GridDisplayLayout.twoColumns;
			this.propertyLayout = PropertyLayoutDirection.row;
		} else if (window.innerWidth < 1366 && window.innerWidth >= 1024) {
			this.gridDisplayLayout = GridDisplayLayout.twoColumns;
			this.propertyLayout = PropertyLayoutDirection.column;
		} else if (window.innerWidth < 1024) {
			this.gridDisplayLayout = GridDisplayLayout.oneColumn;
			this.propertyLayout = PropertyLayoutDirection.column;
		}

		this._changeRef.detectChanges();
	}

	public set propertyItems(propertyItems: PropertyItem[]) {
		this._propertyItems = propertyItems;
		this.layoutPropertyItems();
	}

	public get propertyItems(): PropertyItem[] {
		return this._propertyItems;
	}

	public get showToggleButton(): boolean {
		return this._showToggleButton;
	}

	public set showToggleButton(v: boolean) {
		if (this._showToggleButton !== v) {
			this._showToggleButton = v;
			this._changeRef.detectChanges();
		}
	}
}
