/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, ElementRef, ViewChild, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { localize } from 'vs/nls';

export const COLLAPSE_SELECTOR: string = 'collapse-component';

@Component({
	selector: COLLAPSE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./collapse.component.html'))
})

export class CollapseComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('collapseCellButton', { read: ElementRef }) private collapseCellButtonElement: ElementRef;
	@ViewChild('expandCellButton', { read: ElementRef }) private expandCellButtonElement: ElementRef;

	@Input() cellModel: ICellModel;
	@Input() activeCellId: string;

	constructor() {
		super();
	}

	ngOnInit() {
		this.collapseCellButtonElement.nativeElement.title = localize('collapseCellContents', "Collapse code cell contents");
		this.expandCellButtonElement.nativeElement.title = localize('expandCellContents', "Expand code cell contents");
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
	}

	ngAfterContentInit() {
		this._register(this.cellModel.onCollapseStateChanged(isCollapsed => {
			this.handleCellCollapse(isCollapsed);
		}));
		this.handleCellCollapse(this.cellModel.isCollapsed);
		if (this.activeCellId === this.cellModel.id) {
			this.toggleIconVisibility(true);
		}
	}

	private handleCellCollapse(isCollapsed: boolean): void {
		let collapseButton = <HTMLElement>this.collapseCellButtonElement.nativeElement;
		let expandButton = <HTMLElement>this.expandCellButtonElement.nativeElement;
		if (isCollapsed) {
			collapseButton.style.display = 'none';
			expandButton.style.display = 'block';
		} else {
			collapseButton.style.display = 'block';
			expandButton.style.display = 'none';
		}
	}

	public toggleCollapsed(event?: Event): void {
		if (event) {
			event.stopPropagation();
		}
		this.cellModel.isCollapsed = !this.cellModel.isCollapsed;
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}

	public layout() {

	}

	public toggleIconVisibility(isActiveOrHovered: boolean) {
		let collapseButton = <HTMLElement>this.collapseCellButtonElement.nativeElement;
		let buttonClass = 'icon-hide-cell';
		if (isActiveOrHovered) {
			collapseButton.classList.add(buttonClass);
		} else {
			collapseButton.classList.remove(buttonClass);
		}
	}
}
