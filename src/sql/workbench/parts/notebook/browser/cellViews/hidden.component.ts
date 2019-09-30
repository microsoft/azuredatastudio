/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/workbench/parts/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/parts/notebook/browser/models/notebookModel';

export const HIDDEN_SELECTOR: string = 'hidden-component';

@Component({
	selector: HIDDEN_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./hidden.component.html'))
})

export class HiddenComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('collapseCellButton', { read: ElementRef }) private collapseCellButtonElement: ElementRef;

	@Input() cellModel: ICellModel;
	@Input() model: NotebookModel;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
	}

	public toggleVisibility(event?: Event): void {
		if (event) {
			event.stopPropagation();
		}
		this.cellModel.isHidden = !this.cellModel.isHidden;
	}

	get isVisible(): boolean {
		return !this.cellModel.isHidden;
	}

	public layout() {

	}

	public toggleIconVisibility(isActiveOrHovered: boolean) {
		if (this.collapseCellButtonElement) {
			let collapseButton = <HTMLElement>this.collapseCellButtonElement.nativeElement;
			let buttonClass = 'icon-hide-cell';
			if (isActiveOrHovered) {
				collapseButton.classList.add(buttonClass);
			} else {
				collapseButton.classList.remove(buttonClass);
			}
		}
	}
}
