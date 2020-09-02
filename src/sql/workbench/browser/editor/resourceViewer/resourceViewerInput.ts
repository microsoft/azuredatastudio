/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { ResourceViewerState } from 'sql/workbench/common/editor/resourceViewer/resourceViewerState';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';

export interface ColumnDefinition extends Slick.Column<Slick.SlickData> {
	name: string;
}

export class ResourceViewerInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.resourceviewerinputs';
	public static SCHEMA: string = 'resource-viewer';
	private _data: TableDataView<Slick.SlickData>;
	private _columns: string[] = [];
	private _state: ResourceViewerState;

	private _onColumnsChanged = new Emitter<Slick.Column<Slick.SlickData>[]>();
	public onColumnsChanged: Event<Slick.Column<Slick.SlickData>[]> = this._onColumnsChanged.event;

	constructor() {
		super();
		this._state = new ResourceViewerState();
		let searchFn = (val: { [x: string]: string }, exp: string): Array<number> => {
			let ret = new Array<number>();
			for (let i = 0; i < this._columns.length; i++) {
				let colVal = val[this._columns[i]];
				if (colVal && colVal.toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
					ret.push(i);
				}
			}
			return ret;
		};

		this._data = new TableDataView<Slick.SlickData>(undefined, searchFn, undefined, undefined);
	}

	public getTypeId(): string {
		return ResourceViewerInput.ID;
	}

	public getName(): string {
		return nls.localize('resourceViewerInput.resourceViewer', "Resource Viewer");
	}

	public get data(): TableDataView<Slick.SlickData> {
		return this._data;
	}

	public get columnDefinitions(): ColumnDefinition[] {
		if (this._columns) {
			return this._columns.map(i => {
				return {
					id: i,
					field: i,
					name: i,
					sortable: true
				};
			});
		} else {
			return [];
		}
	}

	public set columns(columns: Array<string>) {
		this._columns = columns;
		this._onColumnsChanged.fire(this.columnDefinitions);
	}

	public get state(): ResourceViewerState {
		return this._state;
	}

	isDirty(): boolean {
		return false; // TODO chgagnon implement
	}
}
