/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as QP from 'html-query-plan';

import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { Dimension } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { Builder } from 'sql/base/browser/builder';
import { dispose, Disposable } from 'vs/base/common/lifecycle';

export class QueryPlanState {
	xml: string;
	dispose() {

	}
}

export class QueryPlanTab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', 'Query Plan');
	public readonly identifier = 'QueryPlanTab';
	public readonly view: QueryPlanView;

	constructor() {
		this.view = new QueryPlanView();
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryPlanView implements IPanelView {
	private qp: QueryPlan;
	private xml: string;
	private container = document.createElement('div');
	private _state: QueryPlanState;

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
		this.container.style.overflow = 'scroll';
		if (!this.qp) {
			this.qp = new QueryPlan(this.container);
			if (this.xml) {
				this.qp.xml = this.xml;
			}
		}
	}

	dispose() {
		this.container.remove();
		this.qp = undefined;
		this.container = undefined;
	}

	public layout(dimension: Dimension): void {
		this.container.style.width = dimension.width + 'px';
		this.container.style.height = dimension.height + 'px';
	}

	public clear() {
		if (this.qp) {
			this.qp.xml = undefined;
		}
	}

	public showPlan(xml: string) {
		if (this.qp) {
			this.qp.xml = xml;
		} else {
			this.xml = xml;
		}
		if (this.state) {
			this.state.xml = xml;
		}
	}

	public set state(val: QueryPlanState) {
		this._state = val;
		if (this.state.xml) {
			this.showPlan(this.state.xml);
		}
	}

	public get state(): QueryPlanState {
		return this._state;
	}
}

export class QueryPlan {
	private _xml: string;
	constructor(private container: HTMLElement) {
	}

	public set xml(xml: string) {
		this._xml = xml;
		new Builder(this.container).empty();
		if (this.xml) {
			QP.showPlan(this.container, this._xml, {
				jsTooltips: false
			});
			(<any>this.container.querySelectorAll('div.qp-tt')).forEach(toolTip => {
				toolTip.classList.add('monaco-editor');
				toolTip.classList.add('monaco-editor-hover');
			});
		}
	}

	public get xml(): string {
		return this._xml;
	}
}
