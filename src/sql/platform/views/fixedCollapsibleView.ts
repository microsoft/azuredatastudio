/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import types = require('vs/base/common/types');
import objects = require('vs/base/common/objects');

import {
	ICollapsibleViewOptions, AbstractCollapsibleView, ViewSizing, CollapsibleState
} from 'sql/base/browser/ui/splitview/splitview';

export interface IFixedCollapsibleViewOptions extends ICollapsibleViewOptions {
	expandedBodySize?: number;
}

export abstract class FixedCollapsibleView extends AbstractCollapsibleView {
	private _expandedBodySize: number;

	constructor(initialSize: number, opts: IFixedCollapsibleViewOptions) {
		super(initialSize, objects.mixin({ sizing: ViewSizing.Fixed }, opts));
		this._expandedBodySize = types.isUndefined(opts.expandedBodySize) ? 22 : opts.expandedBodySize;
	}

	get fixedSize(): number { return this.state === CollapsibleState.EXPANDED ? this.expandedSize : this.headerSize; }
	private get expandedSize(): number { return this.expandedBodySize + this.headerSize; }

	get expandedBodySize(): number { return this._expandedBodySize; }
	set expandedBodySize(size: number) {
		this._expandedBodySize = size;
		this.setFixed(this.fixedSize);
	}

	protected changeState(state: CollapsibleState): void {
		super.changeState(state);
		this.setFixed(this.fixedSize);

		if (this.body) {
			if (state === CollapsibleState.COLLAPSED) {
				// make sure the body goes out of the tabindex world by hiding it
				$(this.body).hide();
			} else {
				$(this.body).show();
			}
		}
	}
}
