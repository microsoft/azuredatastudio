/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DatabaseInfo } from 'azdata';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { DatabaseEngineEdition } from 'sql/workbench/api/common/sqlExtHostTypes';
import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { ConnectionProfilePropertyName, ExplorerTable } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerTable';
import { NameProperty } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerView';
import { ObjectMetadataWrapper } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/objectMetadataWrapper';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { IInputOptions, InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { Delayer } from 'vs/base/common/async';
import { assign } from 'vs/base/common/objects';
import { isStringArray } from 'vs/base/common/types';
import 'vs/css!./media/explorerWidget';
import * as nls from 'vs/nls';
import { IMenuService } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ILogService } from 'vs/platform/log/common/log';
import { IEditorProgressService } from 'vs/platform/progress/common/progress';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { getFlavor } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';

@Component({
	selector: 'explorer-widget',
	templateUrl: decodeURI(require.toUrl('./explorerWidget.component.html'))
})
export class ExplorerWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _input: InputBox;
	private _table: ExplorerTable;
	private _filterDelayer = new Delayer<void>(200);

	@ViewChild('input') private _inputContainer: ElementRef;
	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private readonly _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => Router)) private readonly _router: Router,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private readonly _el: ElementRef,
		@Inject(IWorkbenchThemeService) private readonly themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private readonly contextViewService: IContextViewService,
		@Inject(ILogService) private readonly logService: ILogService,
		@Inject(IContextMenuService) private readonly contextMenuService: IContextMenuService,
		@Inject(IMenuService) private readonly menuService: IMenuService,
		@Inject(IContextKeyService) private readonly contextKeyService: IContextKeyService,
		@Inject(IEditorProgressService) private readonly progressService: IEditorProgressService,
		@Inject(IConnectionManagementService) private readonly connectionManagementService: IConnectionManagementService,
		@Inject(ICapabilitiesService) private readonly capabilitiesService: ICapabilitiesService,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef
	) {
		super(changeRef);
		this._loadingMessage = this._config.context === 'database' ? nls.localize('loadingObjects', "loading objects") : nls.localize('loadingDatabases', "loading databases");
		this._loadingCompletedMessage = this._config.context === 'database' ? nls.localize('loadingObjectsCompleted', "loading objects completed.") : nls.localize('loadingDatabasesCompleted', "loading databases completed.");
		this.init();
	}

	ngOnInit() {
		this._inited = true;
		const flavor = getFlavor(this._bootstrap.connectionManagementService.connectionInfo.serverInfo, this.logService, this._bootstrap.connectionManagementService.connectionInfo.providerId);
		const placeholderLabel = this._config.context === 'database' ?
			flavor && flavor.objectListHintText ? flavor.objectListHintText : nls.localize('seachObjects', "Search by name of type (t:, v:, f:, or sp:)")
			: flavor && flavor.databaseListHintText ? flavor.databaseListHintText : nls.localize('searchDatabases', "Search databases");

		const inputOptions: IInputOptions = {
			placeholder: placeholderLabel,
			ariaLabel: placeholderLabel
		};
		this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
		this._table = new ExplorerTable(this._tableContainer.nativeElement,
			this._router,
			this._config.context,
			this._bootstrap,
			this.themeService,
			this.contextMenuService,
			this.menuService,
			this.contextKeyService,
			this.progressService,
			this.logService);
		this._register(this._input);
		this._register(attachInputBoxStyler(this._input, this.themeService));
		this._register(this._table);
		this._register(this._input.onDidChange(e => {
			this._filterDelayer.trigger(async () => {
				this._table.filter(e);
			});
		}));
	}

	private init(): void {
		this.setLoadingStatus(true);
		if (this._config.context === 'database') {
			this._register(subscriptionToDisposable(this._bootstrap.metadataService.metadata.subscribe(
				data => {
					if (data) {
						const objectData = ObjectMetadataWrapper.createFromObjectMetadata(data.objectMetadata);
						objectData.sort(ObjectMetadataWrapper.sort);
						this.updateTable(objectData);
					}
				},
				error => {
					this.showErrorMessage(nls.localize('dashboard.explorer.objectError', "Unable to load objects"));
				}
			)));
		} else {
			// TODO: remove this ADS side workaround for SQL On-Demand and handle it in SQL Tools Service
			if (this._bootstrap.connectionManagementService.connectionInfo.serverInfo.engineEditionId === DatabaseEngineEdition.SqlOnDemand) {
				this.connectionManagementService.listDatabases(this._bootstrap.connectionManagementService.connectionInfo.ownerUri).then(
					result => {
						// Sort the databases: system databases first and then the sorted list of other databases
						const sysDatabases = ['master', 'model', 'msdb', 'tempdb'];
						const databaseNames = result.databaseNames.filter(db => sysDatabases.indexOf(db) !== -1).
							concat(result.databaseNames.filter(db => sysDatabases.indexOf(db) === -1).sort());
						this.handleServerContextResults(databaseNames);
					},
					error => {
						this.showErrorMessage(nls.localize('dashboard.explorer.databaseError', "Unable to load databases"));
					}
				);
			}
			else {
				this._register(subscriptionToDisposable(this._bootstrap.metadataService.databases.subscribe(
					data => {
						this.handleServerContextResults(data);
					},
					error => {
						this.showErrorMessage(nls.localize('dashboard.explorer.databaseError', "Unable to load databases"));
					}
				)));
			}
		}
	}

	private handleServerContextResults(data: string[] | DatabaseInfo[]): void {
		// Handle the case where there is no metadata service
		data = data || [];
		if (isStringArray(data)) {
			data = data.map(item => {
				const dbInfo: DatabaseInfo = { options: {} };
				dbInfo.options[NameProperty] = item;
				return dbInfo;
			});
		}

		const currentProfile = this._bootstrap.connectionManagementService.connectionInfo.connectionProfile;
		this.updateTable(data.map(d => {
			const item = assign({}, d.options);
			const profile = new ConnectionProfile(this.capabilitiesService, currentProfile);
			profile.databaseName = d.options[NameProperty];
			item[ConnectionProfilePropertyName] = profile;
			return item;
		}));
	}

	private updateTable(data: Slick.SlickData[]) {
		this._table.setData(data);
		this.setLoadingStatus(false);
	}

	public refresh(): void {
		this._input.inputElement.value = '';
		this.init();
	}

	public layout(): void {
		if (this._inited) {
			this._table.layout();
		}
	}

	private showErrorMessage(message: string): void {
		(<HTMLElement>this._el.nativeElement).innerText = message;
		alert(message);
	}

	public getTableHeight(): string {
		return `calc(100% - ${this._input.height}px)`;
	}
}
