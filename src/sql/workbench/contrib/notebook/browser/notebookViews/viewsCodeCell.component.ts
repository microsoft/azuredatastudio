/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { ChangeDetectorRef, Component, forwardRef, Inject } from '@angular/core';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { localize } from 'vs/nls';


export const CODE_SELECTOR: string = 'views-code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./viewsCodeCell.component.html'))
})

export class ViewsCodeCellComponent extends CodeCellComponent {
	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
	}

	get outputs(): nb.ICellOutput[] {
		return this.cellModel.outputs.filter((output: nb.IDisplayResult) => output.data && output.data['text/plain'] !== '<IPython.core.display.HTML object>');
	}

	get emptyCellText(): string {
		return localize('viewsCodeCell.emptyCellText', "Please run this cell to view outputs.");
	}
}
