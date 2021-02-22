/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { deepClone } from 'vs/base/common/objects';
import { ChangeDetectorRef, Component, forwardRef, Inject } from '@angular/core';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';


export const CODE_SELECTOR: string = 'views-code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookViewsCodeCell.component.html'))
})

export class NotebookViewsCodeCellComponent extends CodeCellComponent {
	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
	}

	get outputs(): nb.ICellOutput[] {
		return this.cellModel.outputs
			.filter((output: nb.IDisplayResult) => output.data)
			.filter((output: nb.IDisplayResult) => output.data['text/plain'] !== '<IPython.core.display.HTML object>')
			.filter((output: nb.IDisplayResult) => output.output_type !== 'execute_result')
			.map((output: nb.ICellOutput) => ({ ...output }))
			.map((output: nb.ICellOutput) => { output.metadata = { ...output.metadata, displayActionBar: false }; return output; });
	}

	get viewCellModel(): ICellModel {
		const c = new NotebookViewsCellModel(this.cellModel.toJSON(), { notebook: this.cellModel.notebookModel, isTrusted: this.cellModel.trustedMode });
		return c;
	}

	get emptyCellText(): string {
		return localize('viewsCodeCell.emptyCellText', "Please run this cell to view outputs.");
	}
}

export class NotebookViewsCellModel extends CellModel {
	public get outputs(): Array<nb.ICellOutput> {
		return super.outputs
			.filter((output: nb.IDisplayResult) => output.data)
			.filter((output: nb.IDisplayResult) => output.data['text/plain'] !== '<IPython.core.display.HTML object>')
			.filter((output: nb.IDisplayResult) => output.output_type !== 'execute_result')
			.map((output: nb.ICellOutput) => ({ ...output }))
			.map((output: nb.ICellOutput) => { output.metadata = { ...output.metadata, displayActionBar: false }; return output; });
	}
}
