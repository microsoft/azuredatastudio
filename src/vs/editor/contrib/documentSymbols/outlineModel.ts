/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { binarySearch, coalesceInPlace, equals } from 'vs/base/common/arrays';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { first, forEach, size } from 'vs/base/common/collections';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { LRUCache } from 'vs/base/common/map';
import { commonPrefixLength } from 'vs/base/common/strings';
import { IPosition } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { ITextModel } from 'vs/editor/common/model';
import { DocumentSymbol, DocumentSymbolProvider, DocumentSymbolProviderRegistry } from 'vs/editor/common/modes';
import { MarkerSeverity } from 'vs/platform/markers/common/markers';

export abstract class TreeElement {

	abstract id: string;
	abstract children: { [id: string]: TreeElement };
	abstract parent: TreeElement | undefined;

	abstract adopt(newParent: TreeElement): TreeElement;

	remove(): void {
		if (this.parent) {
			delete this.parent.children[this.id];
		}
	}

	static findId(candidate: DocumentSymbol | string, container: TreeElement): string {
		// complex id-computation which contains the origin/extension,
		// the parent path, and some dedupe logic when names collide
		let candidateId: string;
		if (typeof candidate === 'string') {
			candidateId = `${container.id}/${candidate}`;
		} else {
			candidateId = `${container.id}/${candidate.name}`;
			if (container.children[candidateId] !== undefined) {
				candidateId = `${container.id}/${candidate.name}_${candidate.range.startLineNumber}_${candidate.range.startColumn}`;
			}
		}

		let id = candidateId;
		for (let i = 0; container.children[id] !== undefined; i++) {
			id = `${candidateId}_${i}`;
		}

		return id;
	}

	static getElementById(id: string, element: TreeElement): TreeElement | undefined {
		if (!id) {
			return undefined;
		}
		let len = commonPrefixLength(id, element.id);
		if (len === id.length) {
			return element;
		}
		if (len < element.id.length) {
			return undefined;
		}
		for (const key in element.children) {
			let candidate = TreeElement.getElementById(id, element.children[key]);
			if (candidate) {
				return candidate;
			}
		}
		return undefined;
	}

	static size(element: TreeElement): number {
		let res = 1;
		for (const key in element.children) {
			res += TreeElement.size(element.children[key]);
		}
		return res;
	}

	static empty(element: TreeElement): boolean {
		for (const _key in element.children) {
			return false;
		}
		return true;
	}
}

export interface IOutlineMarker {
	startLineNumber: number;
	startColumn: number;
	endLineNumber: number;
	endColumn: number;
	severity: MarkerSeverity;
}

export class OutlineElement extends TreeElement {

	children: { [id: string]: OutlineElement; } = Object.create(null);
	marker: { count: number, topSev: MarkerSeverity } | undefined;

	constructor(
		readonly id: string,
		public parent: TreeElement | undefined,
		readonly symbol: DocumentSymbol
	) {
		super();
	}

	adopt(parent: TreeElement): OutlineElement {
		let res = new OutlineElement(this.id, parent, this.symbol);
		forEach(this.children, entry => res.children[entry.key] = entry.value.adopt(res));
		return res;
	}
}

export class OutlineGroup extends TreeElement {

	children: { [id: string]: OutlineElement; } = Object.create(null);

	constructor(
		readonly id: string,
		public parent: TreeElement | undefined,
		readonly provider: DocumentSymbolProvider,
		readonly providerIndex: number,
	) {
		super();
	}

	adopt(parent: TreeElement): OutlineGroup {
		let res = new OutlineGroup(this.id, parent, this.provider, this.providerIndex);
		forEach(this.children, entry => res.children[entry.key] = entry.value.adopt(res));
		return res;
	}

	getItemEnclosingPosition(position: IPosition): OutlineElement | undefined {
		return position ? this._getItemEnclosingPosition(position, this.children) : undefined;
	}

	private _getItemEnclosingPosition(position: IPosition, children: { [id: string]: OutlineElement }): OutlineElement | undefined {
		for (let key in children) {
			let item = children[key];
			if (!item.symbol.range || !Range.containsPosition(item.symbol.range, position)) {
				continue;
			}
			return this._getItemEnclosingPosition(position, item.children) || item;
		}
		return undefined;
	}

	updateMarker(marker: IOutlineMarker[]): void {
		for (const key in this.children) {
			this._updateMarker(marker, this.children[key]);
		}
	}

	private _updateMarker(markers: IOutlineMarker[], item: OutlineElement): void {
		item.marker = undefined;

		// find the proper start index to check for item/marker overlap.
		let idx = binarySearch<IRange>(markers, item.symbol.range, Range.compareRangesUsingStarts);
		let start: number;
		if (idx < 0) {
			start = ~idx;
			if (start > 0 && Range.areIntersecting(markers[start - 1], item.symbol.range)) {
				start -= 1;
			}
		} else {
			start = idx;
		}

		let myMarkers: IOutlineMarker[] = [];
		let myTopSev: MarkerSeverity | undefined;

		for (; start < markers.length && Range.areIntersecting(item.symbol.range, markers[start]); start++) {
			// remove markers intersecting with this outline element
			// and store them in a 'private' array.
			let marker = markers[start];
			myMarkers.push(marker);
			(markers as Array<IOutlineMarker | undefined>)[start] = undefined;
			if (!myTopSev || marker.severity > myTopSev) {
				myTopSev = marker.severity;
			}
		}

		// Recurse into children and let them match markers that have matched
		// this outline element. This might remove markers from this element and
		// therefore we remember that we have had markers. That allows us to render
		// the dot, saying 'this element has children with markers'
		for (const key in item.children) {
			this._updateMarker(myMarkers, item.children[key]);
		}

		if (myTopSev) {
			item.marker = {
				count: myMarkers.length,
				topSev: myTopSev
			};
		}

		coalesceInPlace(markers);
	}
}

export class OutlineModel extends TreeElement {

	private static readonly _requests = new LRUCache<string, { promiseCnt: number, source: CancellationTokenSource, promise: Promise<any>, model: OutlineModel | undefined }>(9, 0.75);
	private static readonly _keys = new class {

		private _counter = 1;
		private _data = new WeakMap<DocumentSymbolProvider, number>();

		for(textModel: ITextModel): string {
			return `${textModel.id}/${textModel.getVersionId()}/${this._hash(DocumentSymbolProviderRegistry.all(textModel))}`;
		}

		private _hash(providers: DocumentSymbolProvider[]): string {
			let result = '';
			for (const provider of providers) {
				let n = this._data.get(provider);
				if (typeof n === 'undefined') {
					n = this._counter++;
					this._data.set(provider, n);
				}
				result += n;
			}
			return result;
		}
	};


	static create(textModel: ITextModel, token: CancellationToken): Promise<OutlineModel> {

		let key = this._keys.for(textModel);
		let data = OutlineModel._requests.get(key);

		if (!data) {
			let source = new CancellationTokenSource();
			data = {
				promiseCnt: 0,
				source,
				promise: OutlineModel._create(textModel, source.token),
				model: undefined,
			};
			OutlineModel._requests.set(key, data);
		}

		if (data!.model) {
			// resolved -> return data
			return Promise.resolve(data.model!);
		}

		// increase usage counter
		data!.promiseCnt += 1;

		token.onCancellationRequested(() => {
			// last -> cancel provider request, remove cached promise
			if (--data!.promiseCnt === 0) {
				data!.source.cancel();
				OutlineModel._requests.delete(key);
			}
		});

		return new Promise((resolve, reject) => {
			data!.promise.then(model => {
				data!.model = model;
				resolve(model);
			}, err => {
				OutlineModel._requests.delete(key);
				reject(err);
			});
		});
	}

	static _create(textModel: ITextModel, token: CancellationToken): Promise<OutlineModel> {

		const cts = new CancellationTokenSource(token);
		const result = new OutlineModel(textModel);
		const provider = DocumentSymbolProviderRegistry.ordered(textModel);
		const promises = provider.map((provider, index) => {

			let id = TreeElement.findId(`provider_${index}`, result);
			let group = new OutlineGroup(id, result, provider, index);

			return Promise.resolve(provider.provideDocumentSymbols(result.textModel, cts.token)).then(result => {
				for (const info of result || []) {
					OutlineModel._makeOutlineElement(info, group);
				}
				return group;
			}, err => {
				onUnexpectedExternalError(err);
				return group;
			}).then(group => {
				if (!TreeElement.empty(group)) {
					result._groups[id] = group;
				} else {
					group.remove();
				}
			});
		});

		const listener = DocumentSymbolProviderRegistry.onDidChange(() => {
			const newProvider = DocumentSymbolProviderRegistry.ordered(textModel);
			if (!equals(newProvider, provider)) {
				cts.cancel();
			}
		});

		return Promise.all(promises).then(() => {
			if (cts.token.isCancellationRequested && !token.isCancellationRequested) {
				return OutlineModel._create(textModel, token);
			} else {
				return result._compact();
			}
		}).finally(() => {
			listener.dispose();
		});
	}

	private static _makeOutlineElement(info: DocumentSymbol, container: OutlineGroup | OutlineElement): void {
		let id = TreeElement.findId(info, container);
		let res = new OutlineElement(id, container, info);
		if (info.children) {
			for (const childInfo of info.children) {
				OutlineModel._makeOutlineElement(childInfo, res);
			}
		}
		container.children[res.id] = res;
	}

	static get(element: TreeElement | undefined): OutlineModel | undefined {
		while (element) {
			if (element instanceof OutlineModel) {
				return element;
			}
			element = element.parent;
		}
		return undefined;
	}

	readonly id = 'root';
	readonly parent = undefined;

	protected _groups: { [id: string]: OutlineGroup; } = Object.create(null);
	children: { [id: string]: OutlineGroup | OutlineElement; } = Object.create(null);

	protected constructor(readonly textModel: ITextModel) {
		super();
	}

	adopt(): OutlineModel {
		let res = new OutlineModel(this.textModel);
		forEach(this._groups, entry => res._groups[entry.key] = entry.value.adopt(res));
		return res._compact();
	}

	private _compact(): this {
		let count = 0;
		for (const key in this._groups) {
			let group = this._groups[key];
			if (first(group.children) === undefined) { // empty
				delete this._groups[key];
			} else {
				count += 1;
			}
		}
		if (count !== 1) {
			//
			this.children = this._groups;
		} else {
			// adopt all elements of the first group
			let group = first(this._groups);
			for (let key in group!.children) {
				let child = group!.children[key];
				child.parent = this;
				this.children[child.id] = child;
			}
		}
		return this;
	}

	merge(other: OutlineModel): boolean {
		if (this.textModel.uri.toString() !== other.textModel.uri.toString()) {
			return false;
		}
		if (size(this._groups) !== size(other._groups)) {
			return false;
		}
		this._groups = other._groups;
		this.children = other.children;
		return true;
	}

	getItemEnclosingPosition(position: IPosition, context?: OutlineElement): OutlineElement | undefined {

		let preferredGroup: OutlineGroup | undefined;
		if (context) {
			let candidate = context.parent;
			while (candidate && !preferredGroup) {
				if (candidate instanceof OutlineGroup) {
					preferredGroup = candidate;
				}
				candidate = candidate.parent;
			}
		}

		let result: OutlineElement | undefined = undefined;
		for (const key in this._groups) {
			const group = this._groups[key];
			result = group.getItemEnclosingPosition(position);
			if (result && (!preferredGroup || preferredGroup === group)) {
				break;
			}
		}
		return result;
	}

	getItemById(id: string): TreeElement | undefined {
		return TreeElement.getElementById(id, this);
	}

	updateMarker(marker: IOutlineMarker[]): void {
		// sort markers by start range so that we can use
		// outline element starts for quicker look up
		marker.sort(Range.compareRangesUsingStarts);

		for (const key in this._groups) {
			this._groups[key].updateMarker(marker.slice(0));
		}
	}
}
