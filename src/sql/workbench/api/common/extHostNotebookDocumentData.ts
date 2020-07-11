/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ok } from 'vs/base/common/assert';
import { Schemas } from 'vs/base/common/network';

import { MainThreadNotebookDocumentsAndEditorsShape, INotebookModelChangedData } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { CellRange } from 'sql/workbench/api/common/sqlExtHostTypes';


export class ExtHostNotebookDocumentData implements IDisposable {
	private _document: azdata.nb.NotebookDocument;
	private _isDisposed: boolean = false;
	private _kernelSpec: azdata.nb.IKernelSpec;

	constructor(private readonly _proxy: MainThreadNotebookDocumentsAndEditorsShape,
		private readonly _uri: URI,
		private _providerId: string,
		private _isDirty: boolean,
		private _cells: azdata.nb.NotebookCell[]
	) {
	}

	dispose(): void {
		// we don't really dispose documents but let
		// extensions still read from them. some
		// operations, live saving, will now error tho
		ok(!this._isDisposed);
		this._isDisposed = true;
		this._isDirty = false;
	}


	get document(): azdata.nb.NotebookDocument {
		if (!this._document) {
			const data = this;
			this._document = {
				get uri() { return data._uri; },
				get fileName() { return data._uri.fsPath; },
				get isUntitled() { return data._uri.scheme === Schemas.untitled; },
				get providerId() { return data._providerId; },
				get isClosed() { return data._isDisposed; },
				get isDirty() { return data._isDirty; },
				get cells() { return data._cells; },
				get kernelSpec() { return data._kernelSpec; },
				save() { return data._save(); },
				setTrusted(isTrusted) { data._setTrusted(isTrusted); },
				validateCellRange(range) { return data._validateRange(range); },
			};
		}
		return Object.freeze(this._document);
	}

	private _save(): Thenable<boolean> {
		if (this._isDisposed) {
			return Promise.reject(new Error('Document has been closed'));
		}
		return this._proxy.$trySaveDocument(this._uri);
	}

	private _setTrusted(isTrusted: boolean): Thenable<boolean> {
		if (this._isDisposed) {
			return Promise.reject(new Error('Document has been closed'));
		}
		return this._proxy.$trySetTrusted(this._uri, isTrusted);
	}

	public onModelChanged(data: INotebookModelChangedData) {
		if (data) {
			this._isDirty = data.isDirty;
			this._cells = data.cells;
			this._providerId = data.providerId;
			this._kernelSpec = data.kernelSpec;
		}
	}

	// ---- range math

	private _validateRange(range: azdata.nb.CellRange): azdata.nb.CellRange {
		if (!(range instanceof CellRange)) {
			throw new Error('Invalid argument');
		}

		let start = this._validateIndex(range.start);
		let end = this._validateIndex(range.end);

		if (start === range.start && end === range.end) {
			return range;
		}
		return new CellRange(start, end);
	}

	private _validateIndex(index: number): number {
		if (typeof (index) !== 'number') {
			throw new Error('Invalid argument');
		}

		if (index < 0) {
			index = 0;
		} else if (this._cells.length > 0 && index > this._cells.length) {
			// We allow off by 1 as end needs to be outside current length in order to
			// handle replace scenario. Long term should consider different start vs end validation instead
			index = this._cells.length;
		}

		return index;
	}

}
