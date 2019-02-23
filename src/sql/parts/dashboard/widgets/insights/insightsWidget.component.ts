/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
	Component, Inject, ViewContainerRef, forwardRef, AfterContentInit,
	ComponentFactoryResolver, ViewChild, ChangeDetectorRef
} from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { DashboardWidget, IDashboardWidget, WIDGET_CONFIG, WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { InsightAction, InsightActionContext } from 'sql/workbench/common/actions';
import { toDisposableSubscription } from 'sql/base/node/rxjsUtils';
import { IInsightsConfig, IInsightsView } from './interfaces';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { insertValueRegex } from 'sql/workbench/services/insights/common/insightsDialogService';
import { RunInsightQueryAction } from './actions';

import { SimpleExecuteResult } from 'sqlops';

import { Action } from 'vs/base/common/actions';
import * as types from 'vs/base/common/types';
import * as pfs from 'vs/base/node/pfs';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { WorkbenchState, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IntervalTimer, createCancelablePromise } from 'vs/base/common/async';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { TPromise } from 'vs/base/common/winjs.base';
import { toDisposable } from 'vs/base/common/lifecycle';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

const insightRegistry = Registry.as<IInsightRegistry>(Extensions.InsightContribution);

interface IStorageResult {
	date: string;
	results: SimpleExecuteResult;
}

@Component({
	selector: 'insights-widget',
	template: `
				<div *ngIf="error" style="text-align: center; padding-top: 20px">{{error}}</div>
				<div *ngIf="lastUpdated" style="font-style: italic; font-size: 80%; margin-left: 5px">{{lastUpdated}}</div>
				<div style="margin: 10px; width: calc(100% - 20px); height: calc(100% - 20px)">
					<ng-template component-host></ng-template>
					<loading-spinner [loading]="_loading"></loading-spinner>
				</div>`,
	styles: [':host { width: 100%; height: 100% }']
})
export class InsightsWidget extends DashboardWidget implements IDashboardWidget, AfterContentInit {
	private insightConfig: IInsightsConfig;
	private queryObv: Observable<SimpleExecuteResult>;
	@ViewChild(ComponentHostDirective) private componentHost: ComponentHostDirective;

	private _typeKey: string;
	private _init: boolean = false;
	private _loading: boolean = true;
	private _intervalTimer: IntervalTimer;

	public error: string;
	public lastUpdated: string;

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver,
		@Inject(forwardRef(() => CommonServiceInterface)) private dashboardService: CommonServiceInterface,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ViewContainerRef)) private viewContainerRef: ViewContainerRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IStorageService) private storageService: IStorageService,
		@Inject(IWorkspaceContextService) private workspaceContextService: IWorkspaceContextService,
		@Inject(IConfigurationService) private readonly _configurationService: IConfigurationService
	) {
		super();
		this.insightConfig = <IInsightsConfig>this._config.widget['insights-widget'];

		this._verifyConfig();

		this._parseConfig().then(() => {
			if (!this._checkStorage()) {
				let promise = this._runQuery();
				this.queryObv = Observable.fromPromise(promise);
				let cancelablePromise = createCancelablePromise(() => {
					return promise.then(
						result => {
							this._loading = false;
							if (this._init) {
								this._updateChild(result);
								this.setupInterval();
							} else {
								this.queryObv = Observable.fromPromise(TPromise.as<SimpleExecuteResult>(result));
							}
						},
						error => {
							this._loading = false;
							if (isPromiseCanceledError(error)) {
								return;
							}
							if (this._init) {
								this.showError(error);
							} else {
								this.queryObv = Observable.fromPromise(TPromise.as<SimpleExecuteResult>(error));
							}
						}
					).then(() => this._cd.detectChanges());
				});
				this._register(toDisposable(() => cancelablePromise.cancel()));
			}
		}, error => {
			this.showError(error);
		});
	}

	ngAfterContentInit() {
		this._init = true;
		if (this.queryObv) {
			this._register(toDisposableSubscription(this.queryObv.subscribe(
				result => {
					this._loading = false;
					this._updateChild(result);
					this.setupInterval();
				},
				error => {
					this._loading = false;
					this.showError(error);
				}
			)));
		}
	}

	private setupInterval(): void {
		if (this.insightConfig.autoRefreshInterval) {
			this._intervalTimer = new IntervalTimer();
			this._register(this._intervalTimer);
			this._intervalTimer.cancelAndSet(() => this.refresh(), this.insightConfig.autoRefreshInterval * 60 * 1000);
		}
	}

	private showError(error: string): void {
		this.error = error;
		this._cd.detectChanges();
	}

	get actions(): Array<Action> {
		let actions: Array<Action> = [];
		if (this.insightConfig.details && (this.insightConfig.details.query || this.insightConfig.details.queryFile)) {
			actions.push(this.instantiationService.createInstance(InsightAction, InsightAction.ID, InsightAction.LABEL));
		}
		actions.push(this.instantiationService.createInstance(RunInsightQueryAction, RunInsightQueryAction.ID, RunInsightQueryAction.LABEL));
		return actions;
	}

	get actionsContext(): InsightActionContext {
		return <InsightActionContext>{
			profile: this.dashboardService.connectionManagementService.connectionInfo.connectionProfile,
			insight: this.insightConfig
		};
	}

	private _storeResult(result: SimpleExecuteResult): SimpleExecuteResult {
		if (this.insightConfig.cacheId) {
			let currentTime = new Date();
			let store: IStorageResult = {
				date: currentTime.toString(),
				results: result
			};
			this.lastUpdated = nls.localize('insights.lastUpdated', "Last Updated: {0} {1}", currentTime.toLocaleTimeString(), currentTime.toLocaleDateString());
			this._cd.detectChanges();
			this.storageService.store(this._getStorageKey(), JSON.stringify(store), StorageScope.GLOBAL);
		}
		return result;
	}

	private _checkStorage(): boolean {
		if (this.insightConfig.cacheId) {
			let storage = this.storageService.get(this._getStorageKey(), StorageScope.GLOBAL);
			if (storage) {
				let storedResult: IStorageResult = JSON.parse(storage);
				let date = new Date(storedResult.date);
				this.lastUpdated = nls.localize('insights.lastUpdated', "Last Updated: {0} {1}", date.toLocaleTimeString(), date.toLocaleDateString());
				this._loading = false;
				if (this._init) {
					this._updateChild(storedResult.results);
					this.setupInterval();
					this._cd.detectChanges();
				} else {
					this.queryObv = Observable.fromPromise(Promise.resolve<SimpleExecuteResult>(JSON.parse(storage)));
				}
				return true;
			} else {
				return false;
			}
		}

		return false;
	}

	public refresh(): void {
		this._runQuery().then(
			result => this._updateChild(result),
			error => this.showError(error)
		);
	}

	private _getStorageKey(): string {
		return `insights.${this.insightConfig.cacheId}.${this.dashboardService.connectionManagementService.connectionInfo.connectionProfile.getOptionsKey()}`;
	}

	private _runQuery(): TPromise<SimpleExecuteResult> {
		return TPromise.wrap(this.dashboardService.queryManagementService.runQueryAndReturn(this.insightConfig.query as string).then(
			result => {
				return this._storeResult(result);
			},
			error => {
				throw error;
			}
		));
	}

	private _updateChild(result: SimpleExecuteResult): void {
		this.componentHost.viewContainerRef.clear();
		this.error = undefined;
		this._cd.detectChanges();

		if (result.rowCount === 0) {
			this.showError(nls.localize('noResults', 'No results to show'));
			return;
		}

		let componentFactory = this._componentFactoryResolver.resolveComponentFactory<IInsightsView>(insightRegistry.getCtorFromId(this._typeKey));

		let componentRef = this.componentHost.viewContainerRef.createComponent(componentFactory);
		let componentInstance = componentRef.instance;
		// check if the setter is defined
		if (componentInstance.setConfig) {
			componentInstance.setConfig(this.insightConfig.type[this._typeKey]);
		}
		componentInstance.data = { columns: result.columnInfo.map(item => item.columnName), rows: result.rows.map(row => row.map(item => (item.invariantCultureDisplayValue === null || item.invariantCultureDisplayValue === undefined) ? item.displayValue : item.invariantCultureDisplayValue)) };

		if (componentInstance.init) {
			componentInstance.init();
		}
	}

	private _verifyConfig() {
		if (types.isUndefinedOrNull(this.insightConfig)) {
			throw new Error('Insight config must be defined');
		}

		if (types.isUndefinedOrNull(this.insightConfig.type)) {
			throw new Error('An Insight type must be specified');
		}

		if (Object.keys(this.insightConfig.type).length !== 1) {
			throw new Error('Exactly 1 insight type must be specified');
		}

		if (!insightRegistry.getAllIds().includes(Object.keys(this.insightConfig.type)[0])) {
			throw new Error('The insight type must be a valid registered insight');
		}

		if (!this.insightConfig.query && !this.insightConfig.queryFile) {
			throw new Error('No query was specified for this insight');
		}

		if (this.insightConfig.autoRefreshInterval && !types.isNumber(this.insightConfig.autoRefreshInterval)) {
			throw new Error('Auto Refresh Interval must be a number if specified');
		}

		if (!types.isStringArray(this.insightConfig.query)
			&& !types.isString(this.insightConfig.query)
			&& !types.isString(this.insightConfig.queryFile)) {
			throw new Error('Invalid query or queryfile specified');
		}
	}

	private _parseConfig(): Thenable<void[]> {
		let promises: Array<Promise<void>> = [];

		this._typeKey = Object.keys(this.insightConfig.type)[0];

		// When the editor.accessibilitySupport setting is on, we will force the chart type to be table.
		// so that the information is accessible to the user.
		// count chart type is already a text based chart, we don't have to apply this rule for it.
		let isAccessibilitySupportOn = this._configurationService.getValue('editor.accessibilitySupport') === 'on';
		if (isAccessibilitySupportOn && this._typeKey !== 'count') {
			this._typeKey = 'table';
		}

		if (types.isStringArray(this.insightConfig.query)) {
			this.insightConfig.query = this.insightConfig.query.join(' ');
		} else if (this.insightConfig.queryFile) {
			let filePath = this.insightConfig.queryFile;
			// check for workspace relative path
			let match = filePath.match(insertValueRegex);
			if (match && match.length > 0 && match[1] === 'workspaceRoot') {
				filePath = filePath.replace(match[0], '');

				//filePath = this.dashboardService.workspaceContextService.toResource(filePath).fsPath;
				switch (this.workspaceContextService.getWorkbenchState()) {
					case WorkbenchState.FOLDER:
						filePath = this.workspaceContextService.getWorkspace().folders[0].toResource(filePath).fsPath;
						break;
					case WorkbenchState.WORKSPACE:
						let filePathArray = filePath.split('/');
						// filter out empty sections
						filePathArray = filePathArray.filter(i => !!i);
						let folder = this.workspaceContextService.getWorkspace().folders.find(i => i.name === filePathArray[0]);
						if (!folder) {
							return Promise.reject(new Error(`Could not find workspace folder ${filePathArray[0]}`));
						}
						// remove the folder name from the filepath
						filePathArray.shift();
						// rejoin the filepath after doing the work to find the right folder
						filePath = '/' + filePathArray.join('/');
						filePath = folder.toResource(filePath).fsPath;
						break;
				}

			}
			promises.push(new Promise((resolve, reject) => {
				pfs.readFile(filePath).then(
					buffer => {
						this.insightConfig.query = buffer.toString();
						resolve();
					},
					error => {
						reject(error);
					}
				);
			}));
		}

		return Promise.all(promises);
	}
}
