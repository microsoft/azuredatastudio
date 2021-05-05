/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { ChangeDetectorRef, Component, forwardRef, Inject, Input, OnChanges, SimpleChange } from '@angular/core';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';

export const CODE_SELECTOR: string = 'views-code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookViewsCodeCell.component.html'))
})

export class NotebookViewsCodeCellComponent extends CodeCellComponent implements OnChanges {
	@Input() display: boolean;

	public stdIn: nb.IStdinMessage;

	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
	}

	ngOnInit() {
		if (this.cellModel) {
			this._register(this.cellModel.onCollapseStateChanged((state) => {
				this._changeRef.detectChanges();
			}));
			this._register(this.cellModel.onParameterStateChanged((state) => {
				this._changeRef.detectChanges();
			}));
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));

			// If we have a pre-existing message, listen to that
			if (this.cellModel?.future?.msg) {
				this.handleStdIn(this.cellModel.future.msg as nb.IStdinMessage);
			}

			// Register request handler, cleanup on dispose of this component
			this.cellModel.setStdInHandler({ handle: (msg) => super.handleStdIn(msg) });
			this._register({ dispose: () => this.cellModel.setStdInHandler(undefined) });
		}
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				super._activeCellId = changedProp.currentValue;
				break;
			}
		}
	}

	get outputs(): readonly nb.ICellOutput[] {
		return this.cellModel.outputs;
		/*
		.filter((output: nb.IDisplayResult) => output.data)
		//.filter((output: nb.IDisplayResult) => output.data['text/plain'] !== '<IPython.core.display.HTML object>')
		.filter((output: nb.IDisplayResult) => output.output_type !== 'execute_result')
		.map((output: nb.ICellOutput) => ({ ...output }))
		.map((output: nb.ICellOutput) => { output.metadata = { ...output.metadata, displayActionBar: false }; return output; });
		*/
	}

	get viewCellModel(): ICellModel {
		return new NotebookViewsCellModel(this.cellModel.toJSON(), { notebook: this.cellModel.notebookModel, isTrusted: this.cellModel.trustedMode });
	}

	get emptyCellText(): string {
		return localize('viewsCodeCell.emptyCellText', "Please run this cell to view outputs.");
	}
}

export class NotebookViewsCellModel extends CellModel {
	public get outputs(): Array<nb.ICellOutput> {
		return super.outputs;
		/*
			.filter((output: nb.IDisplayResult) => output.data)
			//.filter((output: nb.IDisplayResult) => output.data['text/plain'] !== '<IPython.core.display.HTML object>')
			//.filter((output: nb.IDisplayResult) => output.output_type !== 'execute_result')
			.map((output: nb.ICellOutput) => ({ ...output }))
			.map((output: nb.ICellOutput) => { output.metadata = { ...output.metadata, displayActionBar: false }; return output; });
		*/
	}
}
