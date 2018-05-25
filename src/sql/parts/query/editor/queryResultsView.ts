/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';

import { Dimension, $ } from 'vs/base/browser/builder';
import * as nls from 'vs/nls';
import * as UUID from 'vs/base/common/uuid';
import { ViewletPanel, PanelViewlet } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';

class GridPanel extends ViewletPanel {
	protected renderBody(container: HTMLElement): void {
		container.innerText = 'Results';
	}
	protected layoutBody(size: number): void {
	}
}

class MessagePanel extends ViewletPanel {
	protected renderBody(container: HTMLElement): void {
		container.innerText = 'Messages';
	}
	protected layoutBody(size: number): void {
	}
}

class ResultsView implements IPanelView {
	private panelViewlet: PanelViewlet;
	private gridPanel: GridPanel;
	private messagePanel: MessagePanel;
	private container = document.createElement('div');

	constructor(private instantiationService: IInstantiationService) {
		this.panelViewlet = this.instantiationService.createInstance(PanelViewlet, 'resultsView', { showHeaderInTitleWhenSingleView: true });
		this.gridPanel = this.instantiationService.createInstance(GridPanel, nls.localize('gridPanel', 'Results'), {});
		this.messagePanel = this.instantiationService.createInstance(MessagePanel, nls.localize('messagePanel', 'Messages'), {});
		this.panelViewlet.create($(this.container)).then(() => {
			this.panelViewlet.addPanel(this.gridPanel, 1, 0);
			this.panelViewlet.addPanel(this.messagePanel, 1, 1);
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: Dimension): void {
		this.panelViewlet.layout(dimension);
	}
}

class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', 'Results');
	public readonly identifier = UUID.generateUuid();
	public readonly view: IPanelView;

	constructor(instantiationService: IInstantiationService) {
		this.view = new ResultsView(instantiationService);
	}
}

export class QueryResultsView {
	private _panelView: TabbedPanel;
	private _input: QueryResultsInput;
	private resultsTab: ResultsTab;

	constructor(
		container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		this.resultsTab = new ResultsTab(instantiationService);
		this._panelView = new TabbedPanel(container, { showHeaderWhenSingleView: false });
	}

	public style() {

	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		this._panelView.pushTab(this.resultsTab);
	}

	public get input(): QueryResultsInput {
		return this._input;
	}

	public layout(dimension: Dimension) {
		this._panelView.layout(dimension);
	}
}
