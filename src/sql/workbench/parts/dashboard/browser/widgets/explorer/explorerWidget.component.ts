/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/objectTypes/objecttypes';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/explorerWidget';

import { Component, Inject, forwardRef, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/parts/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { ExplorerFilter, ExplorerRenderer, ExplorerDataSource, ExplorerController, ObjectMetadataWrapper, ExplorerModel } from './explorerTree';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

import { InputBox, IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { attachInputBoxStyler, attachListStyler } from 'vs/platform/theme/common/styler';
import * as nls from 'vs/nls';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { getContentHeight } from 'vs/base/browser/dom';
import { Delayer } from 'vs/base/common/async';
import { IContextViewService, IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorProgressService } from 'vs/platform/progress/common/progress';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';

@Component({
	selector: 'explorer-widget',
	templateUrl: decodeURI(require.toUrl('./explorerWidget.component.html'))
})
export class ExplorerWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _input: InputBox;
	private _tree: Tree;
	private _filterDelayer = new Delayer<void>(200);
	private _treeController = new ExplorerController(
		this._bootstrap.getUnderlyingUri(),
		this._bootstrap.connectionManagementService,
		this._router,
		this.contextMenuService,
		this.capabilitiesService,
		this.instantiationService,
		this.progressService
	);
	private _treeRenderer = new ExplorerRenderer();
	private _treeDataSource = new ExplorerDataSource();
	private _treeFilter = new ExplorerFilter();

	private _inited = false;

	@ViewChild('input') private _inputContainer: ElementRef;
	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(ICapabilitiesService) private capabilitiesService: ICapabilitiesService,
		@Inject(IEditorProgressService) private progressService: IEditorProgressService
	) {
		super();
		this.init();
	}

	ngOnInit() {
		this._inited = true;

		const placeholderLabel = this._config.context === 'database' ? nls.localize('seachObjects', "Search by name of type (a:, t:, v:, f:, or sp:)") : nls.localize('searchDatabases', "Search databases");

		const inputOptions: IInputOptions = {
			placeholder: placeholderLabel,
			ariaLabel: placeholderLabel
		};
		this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
		this._register(this._input.onDidChange(e => {
			this._filterDelayer.trigger(() => {
				this._treeFilter.filterString = e;
				this._tree.refresh();
			});
		}));
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		}, { horizontalScrollMode: ScrollbarVisibility.Auto });
		this._tree.layout(getContentHeight(this._tableContainer.nativeElement));
		this._register(this._input);
		this._register(attachInputBoxStyler(this._input, this.themeService));
		this._register(this._tree);
		this._register(attachListStyler(this._tree, this.themeService));
	}

	private init(): void {
		if (this._config.context === 'database') {
			this._register(subscriptionToDisposable(this._bootstrap.metadataService.metadata.subscribe(
				data => {
					if (data) {
						const objectData = ObjectMetadataWrapper.createFromObjectMetadata(data.objectMetadata);
						objectData.sort(ObjectMetadataWrapper.sort);
						this._treeDataSource.data = objectData;
						this._tree.setInput(new ExplorerModel());
					}
				},
				error => {
					(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.explorer.objectError', "Unable to load objects");
				}
			)));
		} else {
			const currentProfile = this._bootstrap.connectionManagementService.connectionInfo.connectionProfile;
			this._register(subscriptionToDisposable(this._bootstrap.metadataService.databaseNames.subscribe(
				data => {
					// Handle the case where there is no metadata service
					data = data || [];
					const profileData = data.map(d => {
						const profile = new ConnectionProfile(this.capabilitiesService, currentProfile);
						profile.databaseName = d;
						return profile;
					});
					this._treeDataSource.data = profileData;
					this._tree.setInput(new ExplorerModel());
				},
				error => {
					(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.explorer.databaseError', "Unable to load databases");
				}
			)));
		}
	}

	public refresh(): void {
		this.init();
	}

	public layout(): void {
		if (this._inited) {
			this._tree.layout(getContentHeight(this._tableContainer.nativeElement));
		}
	}
}
