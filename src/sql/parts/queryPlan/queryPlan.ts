/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as QP from 'html-query-plan';

import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { Dimension } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import * as UUID from 'vs/base/common/uuid';
import { Builder } from 'vs/base/browser/builder';

export class QueryPlanState {
	xml: string;
}

export class QueryPlanTab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', 'Query Plan');
	public readonly identifier = 'QueryPlanTab';
	public readonly view: QueryPlanView;

	constructor() {
		this.view = new QueryPlanView();
	}
}

export class QueryPlanView implements IPanelView {
	private qp: QueryPlan;
	private xml: string;
	private container = document.createElement('div');
	private _state: QueryPlanState;

	public render(container: HTMLElement): void {
		if (!this.qp) {
			this.qp = new QueryPlan(this.container);
			if (this.xml) {
				this.qp.xml = this.xml;
			}
		}
		container.appendChild(this.container);
		container.style.overflow = 'scroll';
	}

	public layout(dimension: Dimension): void {
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
		QP.showPlan(this.container, this._xml, {
			jsTooltips: false
		});
	}

	public get xml(): string {
		return this._xml;
	}
}
