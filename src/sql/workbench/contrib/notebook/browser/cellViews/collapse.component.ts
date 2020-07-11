/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, ElementRef, ViewChild, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { localize } from 'vs/nls';

export const COLLAPSE_SELECTOR: string = 'collapse-component';

@Component({
	selector: COLLAPSE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./collapse.component.html'))
})

export class CollapseComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('collapseCellButton', { read: ElementRef }) private collapseCellButtonElement: ElementRef;

	private readonly expandButtonTitle = localize('expandCellContents', "Expand code cell contents");
	private readonly expandButtonClass = 'arrow-down';

	private readonly collapseButtonTitle = localize('collapseCellContents', "Collapse code cell contents");
	private readonly collapseButtonClass = 'arrow-up';

	@Input() cellModel: ICellModel;
	@Input() activeCellId: string;

	constructor() {
		super();
	}

	ngOnInit() {
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
		if (isCollapsed) {
			collapseButton.classList.remove(this.collapseButtonClass);
			collapseButton.classList.add(this.expandButtonClass);
			collapseButton.title = this.expandButtonTitle;
		} else {
			collapseButton.classList.remove(this.expandButtonClass);
			collapseButton.classList.add(this.collapseButtonClass);
			collapseButton.title = this.collapseButtonTitle;
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
		if (collapseButton.title === this.collapseButtonTitle) {
			if (isActiveOrHovered) {
				collapseButton.classList.add(this.collapseButtonClass);
			} else {
				collapseButton.classList.remove(this.collapseButtonClass);
			}
		}
	}
}
