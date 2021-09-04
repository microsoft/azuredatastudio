import { nb } from 'azdata';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookView } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';

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

	addCell(cell: T, initialView: INotebookView) {
		const dCell = new DisplayCell<T>(cell);
		this._displayCells.push(dCell);
		this._visInfos.push(this.evaluateCell(cell, initialView));
	}

	get visInfos(): VisInfo<T>[] {
		return this._visInfos;
	}

	get displayCells(): DisplayCell<T>[] {
		return this._displayCells;
	}

	abstract evaluateCell(cell: T, view: INotebookView): VisInfo<T>;
}

class CellDisplayGroup extends DisplayGroup<ICellModel> {
	evaluateCell(cell: ICellModel, view: INotebookView): VisInfo<ICellModel> {
		let meta = view.getCellMetadata(cell);
		let visInfo = new VisInfo<ICellModel>();
		visInfo.cell = cell;

		if (cell.cellType !== CellTypes.Code && !this.isHeader(cell)) {
			visInfo.display = false;
			return visInfo;
		}

		if (cell.cellType === CellTypes.Code && (!cell.outputs || !cell.outputs.length)) {
			visInfo.display = false;
			return visInfo;
		}

		//For headers
		if (this.isHeader(cell)) {
			visInfo.height = 1;
		}
		//For graphs
		if (this.hasGraph(cell)) {
			visInfo.width = 6;
			visInfo.height = 4;
		}
		//For tables
		else if (this.hasTable(cell)) {
			visInfo.height = Math.min(meta?.height, 3);
		} else {
			visInfo.height = Math.min(meta?.height, 3);
		}

		visInfo.display = true;
		return visInfo;
	}

	isHeader(cell: ICellModel): boolean {
		return cell.cellType === 'markdown' && cell.source.length === 1 && cell.source[0].startsWith('#');
	}

	hasGraph(cell: ICellModel): boolean {
		return !!cell.outputs.find((o: nb.IDisplayResult) => o?.output_type === 'display_data' && o?.data.hasOwnProperty('application/vnd.plotly.v1+json'));
	}

	hasTable(cell: ICellModel): boolean {
		return !!cell.outputs.find((o: nb.IDisplayResult) => o?.output_type === 'display_data' && o?.data.hasOwnProperty('application/vnd.dataresource+json'));
	}
}

export function generateLayout(initialView: INotebookView): void {
	let displayGroup: CellDisplayGroup = new CellDisplayGroup();

	const cells = initialView.cells;

	cells.forEach((cell, idx) => {
		displayGroup.addCell(cell, initialView);
	});

	displayGroup.visInfos.forEach((v) => {
		if (!v.display) {
			initialView.hideCell(v.cell);
		}

		if (v.width || v.height) {
			initialView.resizeCell(v.cell, v.width, v.height);
		}
	});

	initialView.compactCells();
}
