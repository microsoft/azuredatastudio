/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Input, ViewChild, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import * as _html2canvas from 'html2canvas';
import { GridStackComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/gridstack.component';

const html2canvas: any = _html2canvas;

export const PLACEHOLDER_SELECTOR: string = 'dashboard-view-component';

@Component({
	selector: PLACEHOLDER_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./dashboardView.component.html'))
})

export class DashboardViewComponent {
	@Input() cells: ICellModel[];
	@Input() model: NotebookModel;

	@ViewChild(GridStackComponent) private gridstack: GridStackComponent;

	images: string[]; //This ultimately will be insertItemWidgets

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		//super();
	}

	ngAfterViewInit() {
		this.screenshot();
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	public async screenshot() {

		const hiddenItems = this.gridstack.hiddenItems;
		//const elem = this.gridstack.nativeElement.querySelector('[data-cell-id]');

		const items = hiddenItems.filter(item => !item.display);
		const insertItemWidgets = items.map(item => item.elementRef);

		const funcs = insertItemWidgets.map(async item => {
			const canvas = await html2canvas(item.nativeElement);
			return canvas ? canvas.toDataURL() : undefined;
		});

		const images = await Promise.all(funcs);

		this.images = images;

		this.detectChanges();
	}
}
