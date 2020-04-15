/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tree';
import { Iterable } from 'vs/base/common/iterator';
import { AbstractTree, IAbstractTreeOptions } from 'vs/base/browser/ui/tree/abstractTree';
import { ISpliceable } from 'vs/base/common/sequence';
import { IndexTreeModel } from 'vs/base/browser/ui/tree/indexTreeModel';
import { ITreeElement, ITreeModel, ITreeNode, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { IListVirtualDelegate } from 'vs/base/browser/ui/list/list';

export interface IIndexTreeOptions<T, TFilterData = void> extends IAbstractTreeOptions<T, TFilterData> { }

export class IndexTree<T, TFilterData = void> extends AbstractTree<T, TFilterData, number[]> {

	protected model!: IndexTreeModel<T, TFilterData>;

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: ITreeRenderer<T, TFilterData, any>[],
		private rootElement: T,
		options: IIndexTreeOptions<T, TFilterData> = {}
	) {
		super(user, container, delegate, renderers, options);
	}

	splice(location: number[], deleteCount: number, toInsert: Iterable<ITreeElement<T>> = Iterable.empty()): void {
		this.model.splice(location, deleteCount, toInsert);
	}

	rerender(location?: number[]): void {
		if (location === undefined) {
			this.view.rerender();
			return;
		}

		this.model.rerender(location);
	}

	protected createModel(user: string, view: ISpliceable<ITreeNode<T, TFilterData>>, options: IIndexTreeOptions<T, TFilterData>): ITreeModel<T, TFilterData, number[]> {
		return new IndexTreeModel(user, view, this.rootElement, options);
	}
}
