/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/qp';
import * as QP from 'html-query-plan';

import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { Dimension, clearNode } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { QueryPlanState } from 'sql/workbench/common/editor/query/queryPlanState';

export class QueryPlanTab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', "Query Plan");
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
	private qp?: QueryPlan;
	private xml?: string;
	private container = document.createElement('div');
	private _state?: QueryPlanState;

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

	public setState(val: QueryPlanState) {
		this._state = val;
		if (this._state.xml) {
			this.showPlan(this._state.xml);
		}
	}

	public get state(): QueryPlanState | undefined {
		return this._state;
	}
}

export class QueryPlan {
	private _xml?: string;
	constructor(private container: HTMLElement) {
	}

	public set xml(xml: string | undefined) {
		this._xml = xml;
		clearNode(this.container);
		if (this.xml) {
			QP.showPlan(this.container, this.xml, {
				jsTooltips: false
			});
			this.container.querySelectorAll('div.qp-tt').forEach(toolTip => {
				toolTip.classList.add('monaco-editor');
				toolTip.classList.add('monaco-editor-hover');
			});
		}
	}

	public get xml(): string | undefined {
		return this._xml;
	}
}
