/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/qp';

import { ElementRef, Component, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as QP from 'html-query-plan';

import { IQueryPlanParams, IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { registerThemingParticipant, ICssStyleCollector, IColorTheme } from 'vs/platform/theme/common/themeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';

export const QUERYPLAN_SELECTOR: string = 'queryplan-component';

@Component({
	selector: QUERYPLAN_SELECTOR,
	template: `
				<div #container class="fullsize" style="overflow: scroll">
				</div>
	`
})
export class QueryPlanComponent implements OnDestroy, OnInit {

	private _planXml: string;
	private _disposables: Array<IDisposable> = [];
	@ViewChild('container', { read: ElementRef }) _container: ElementRef;

	constructor(
		@Inject(IBootstrapParams) private _params: IQueryPlanParams
	) { }

	ngOnDestroy() {
		dispose(this._disposables);
	}

	ngOnInit() {
		if (this._params) {
			this.planXml = this._params.planXml;
		}
		this._disposables.push(registerThemingParticipant(this._updateTheme));
	}

	public set planXml(val: string) {
		this._planXml = val;
		if (this._planXml) {
			QP.showPlan(this._container.nativeElement, this._planXml, {
				jsTooltips: false
			});
		}
	}

	private _updateTheme(theme: IColorTheme, collector: ICssStyleCollector) {
		let backgroundColor = theme.getColor(colors.editorBackground);
		let foregroundColor = theme.getColor(colors.editorForeground);

		if (backgroundColor) {
			collector.addRule(`div.qp-node, .qp-tt, .qp-root { background-color: ${backgroundColor} }`);
		}

		if (foregroundColor) {
			collector.addRule(`.qp-root { color: ${foregroundColor} }`);
		}
	}
}
