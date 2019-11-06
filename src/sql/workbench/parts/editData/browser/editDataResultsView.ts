/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditDataResultsInput } from 'sql/workbench/parts/editData/browser/editDataResultsInput';
import { dispose, Disposable, DisposableStore } from 'vs/base/common/lifecycle';



import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { MessagePanel } from 'sql/workbench/parts/query/browser/messagePanel';
import { GridPanel } from 'sql/workbench/parts/query/browser/gridPanel';
import { ChartTab } from 'sql/workbench/parts/charts/browser/chartTab';
import { QueryPlanTab } from 'sql/workbench/parts/queryPlan/browser/queryPlan';
import { TopOperationsTab } from 'sql/workbench/parts/queryPlan/browser/topOperations';
import { QueryModelViewTab } from 'sql/workbench/parts/query/browser/modelViewTab/queryModelViewTab';
import { MessagePanelState } from 'sql/workbench/parts/query/common/messagePanelState';
import { GridPanelState } from 'sql/workbench/parts/query/common/gridPanelState';
import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { attachTabbedPanelStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event } from 'vs/base/common/event';

export class EditDataView extends Disposable {

	private _input: EditDataResultsInput;
	private _panelView: TabbedPanel;

	constructor(
		container: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService
	) {
		super();
		//this.resultsTab = this._register(new ResultsTab(instantiationService));
	}
	public layout(dimension: DOM.Dimension) {
		this._panelView.layout(dimension);
	}

	public set input(input: EditDataResultsInput) {
		this._input = input;
	}

	clearInput() {
		this._input = undefined;
	}

	public get input(): EditDataResultsInput {
		return this._input;
	}

	public dispose() {
		super.dispose();
	}

}

