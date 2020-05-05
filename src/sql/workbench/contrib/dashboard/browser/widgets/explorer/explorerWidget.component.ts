/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/explorerWidget';

import { Component, Inject, forwardRef, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
//import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
//import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { InputBox, IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import * as nls from 'vs/nls';
//import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { Delayer } from 'vs/base/common/async';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';
import { ObjectMetadataWrapper } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/objectMetadataWrapper';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { isStringArray } from 'vs/base/common/types';
import { DatabaseInfo } from 'azdata';
import { getFlavor } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { ILogService } from 'vs/platform/log/common/log';
import { ExplorerTable, NameProperty } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerTable';

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
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private readonly _el: ElementRef,
		@Inject(IWorkbenchThemeService) private readonly themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private readonly contextViewService: IContextViewService,
		@Inject(ILogService) private readonly logService: ILogService,
		//@Inject(ICapabilitiesService) private readonly capabilitiesService: ICapabilitiesService,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef
	) {
		super(changeRef);
		this._loadingMessage = this._config.context === 'database' ? nls.localize('loadingObjects', "loading objects") : nls.localize('loadingDatabases', "loading databases");
		this._loadingCompletedMessage = this._config.context === 'database' ? nls.localize('loadingObjectsCompleted', "loading objects completed.") : nls.localize('loadingDatabasesCompleted', "loading databases completed.");
		this.init();
	}

	ngOnInit() {
		this._inited = true;

		const placeholderLabel = this._config.context === 'database' ? nls.localize('seachObjects', "Search by name of type (t:, v:, f:, or sp:)") : nls.localize('searchDatabases', "Search databases");

		const inputOptions: IInputOptions = {
			placeholder: placeholderLabel,
			ariaLabel: placeholderLabel
		};
		this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
		const serverInfo = this._bootstrap.connectionManagementService.connectionInfo.serverInfo;
		const flavorProperties = getFlavor(serverInfo, this.logService, this._bootstrap.connectionManagementService.connectionInfo.providerId);
		this._table = new ExplorerTable(this._tableContainer.nativeElement, this.themeService, this._config.context, flavorProperties);
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
			this._register(subscriptionToDisposable(this._bootstrap.metadataService.databases.subscribe(
				data => {
					// Handle the case where there is no metadata service
					data = data || [];
					if (isStringArray(data)) {
						data = data.map(item => {
							const dbInfo: DatabaseInfo = { options: {} };
							dbInfo.options[NameProperty] = item;
							return dbInfo;
						});
					}

					// const profileData = data.map(d => {
					// 	const profile = new ConnectionProfile(this.capabilitiesService, currentProfile);
					// 	profile.databaseName = d.options['name'];
					// 	return profile;
					// });
					this.updateTable(data.map(item => item.options));
				},
				error => {
					this.showErrorMessage(nls.localize('dashboard.explorer.databaseError', "Unable to load databases"));
				}
			)));
		}
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
