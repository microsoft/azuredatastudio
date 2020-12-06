/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookView } from 'sql/workbench/services/notebook/browser/models/notebookViewModel';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { Disposable } from 'vs/base/common/lifecycle';

class VisInfo<T> {
	public width: number;
	public height: number;
	public orderRank: number;
	public display: boolean;
	public cell: T;
}

class DisplayCell<T> {
	constructor(private _item: T) { }

	get item(): T {
		return this._item;
	}
}

abstract class DisplayGroup<T> {
	public width: number;
	public height: number;
	public orderRank: number;
	public display: boolean;
	private _displayCells: DisplayCell<T>[] = [];
	private _visInfos: VisInfo<T>[] = [];

	constructor() { }

	addCell(cell: T) {
		const dCell = new DisplayCell<T>(cell);
		this._displayCells.push(dCell);
		this._visInfos.push(this.evaluateCell(cell));
	}

	get visInfos(): VisInfo<T>[] {
		return this._visInfos;
	}

	get displayCells(): DisplayCell<T>[] {
		return this._displayCells;
	}

	abstract evaluateCell(cell: T): VisInfo<T>;
}

class CellDisplayGroup extends DisplayGroup<ICellModel> {
	evaluateCell(cell: ICellModel): VisInfo<ICellModel> {
		let visInfo = new VisInfo<ICellModel>();
		visInfo.cell = cell;

		if ((cell.cellType !== CellTypes.Code && !this.isHeader(cell)) || (cell.cellType === CellTypes.Code && !this.hasGraph(cell))) {
			visInfo.display = false;
			return visInfo;
		}

		if (cell.cellType === CellTypes.Code && (!cell.outputs || !cell.outputs.length)) {
			visInfo.display = false;
			return visInfo;
		}

		//const output = cell.renderedOutputTextContent.concat();

		visInfo.display = true;
		return visInfo;
	}

	isHeader(cell: ICellModel): boolean {
		return cell.cellType === 'markdown' && cell.source.length === 1 && cell.source[0].startsWith('#');
	}

	hasGraph(cell: ICellModel): boolean {
		return !!cell.outputs.find((o: nb.IDisplayResult) => o?.output_type === 'display_data' && o?.data);
	}
}

export class AutoDash extends Disposable {
	private readonly _displayGroup: CellDisplayGroup;
	/*
	private readonly _maxHeight: number = 10;
	private readonly _minWidth: number = 1;
	private readonly _maxWidth: number = 12;
	private readonly _minHeight: number = 1;
	*/

	constructor() {
		super();
		this._displayGroup = new CellDisplayGroup();
	}

	containsGraph(output: string): boolean {
		return output.includes('output-canvas');
	}

	generateLayout(initialView: INotebookView): INotebookView {
		const cells = initialView.cells;

		cells.forEach((cell, idx) => {
			this._displayGroup.addCell(cell);
		});

		let idx = 0;
		this._displayGroup.visInfos.forEach((v) => {

			if (!v.display) {
				initialView.hideCell(v.cell);
			}

			initialView.moveCell(v.cell, 0, idx * 5);
			initialView.resizeCell(v.cell, 12, 5);
			idx++;
		});

		return initialView;
	}



}
