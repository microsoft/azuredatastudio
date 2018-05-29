/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from '../execution/queryModel';
import { DataService } from 'sql/parts/grid/services/dataService';
import QueryRunner, { EventType } from 'sql/parts/query/execution/queryRunner';
import { MessagePanel } from './messagePanel';
import { GridPanel } from './gridPanel';

import { Dimension, $ } from 'vs/base/browser/builder';
import * as nls from 'vs/nls';
import * as UUID from 'vs/base/common/uuid';
import { ViewletPanel, PanelViewlet } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import Event, { Emitter } from 'vs/base/common/event';

import { IResultMessage } from 'sqlops';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

class ResultsView implements IPanelView {
	private panelViewlet: PanelViewlet;
	private gridPanel: GridPanel;
	private messagePanel: MessagePanel;
	private container = document.createElement('div');

	private _onRemove = new Emitter<void>();
	public readonly onRemove = this._onRemove.event;

	private _onLayout = new Emitter<void>();
	public readonly onLayout = this._onLayout.event;

	private queryRunnerDisposable: IDisposable[] = [];

	constructor(instantiationService: IInstantiationService) {
		this.panelViewlet = instantiationService.createInstance(PanelViewlet, 'resultsView', { showHeaderInTitleWhenSingleView: true });
		this.gridPanel = instantiationService.createInstance(GridPanel, nls.localize('gridPanel', 'Results'), {});
		this.messagePanel = instantiationService.createInstance(MessagePanel, nls.localize('messagePanel', 'Messages'), {});
		this.panelViewlet.create($(this.container)).then(() => {
			this.panelViewlet.addPanel(this.gridPanel, 1, 0);
			this.panelViewlet.addPanel(this.messagePanel, this.messagePanel.minimumSize, 1);
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: Dimension): void {
		this.panelViewlet.layout(dimension);
	}

	remove(): void {
		this.container.remove();
	}

	public set queryRunner(runner: QueryRunner) {
		dispose(this.queryRunnerDisposable);
		this.queryRunnerDisposable = [];
		this.gridPanel.reset();
		this.messagePanel.reset();
		this.gridPanel.runner = runner;
		this.queryRunnerDisposable.push(runner.onResultSet(e => {
			this.gridPanel.onResultSet(e);
		}));
		this.queryRunnerDisposable.push(runner.onMessage(e => {
			this.messagePanel.onMessage(e);
		}));
		this.queryRunnerDisposable.push(runner.onStartQuery(() => {
			this.gridPanel.reset();
			this.messagePanel.reset();
		}));
	}
}

class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', 'Results');
	public readonly identifier = UUID.generateUuid();
	public readonly view: ResultsView;

	private _isAttached = false;

	constructor(instantiationService: IInstantiationService) {
		this.view = new ResultsView(instantiationService);

		this.view.onLayout(() => this._isAttached = true, this);
		this.view.onRemove(() => this._isAttached = false, this);
	}

	public isAttached(): boolean {
		return this._isAttached;
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}
}

export class QueryResultsView {
	private _panelView: TabbedPanel;
	private _input: QueryResultsInput;
	private resultsTab: ResultsTab;

	constructor(
		container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService
	) {
		this.resultsTab = new ResultsTab(instantiationService);
		this._panelView = new TabbedPanel(container, { showHeaderWhenSingleView: false });
	}

	public style() {

	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		this.resultsTab.queryRunner = this.queryModelService._getQueryInfo(input.uri).queryRunner;
		// if (!this.resultsTab.isAttached) {
		this._panelView.pushTab(this.resultsTab);
		// }
	}

	public get input(): QueryResultsInput {
		return this._input;
	}

	public layout(dimension: Dimension) {
		this._panelView.layout(dimension);
	}
}
