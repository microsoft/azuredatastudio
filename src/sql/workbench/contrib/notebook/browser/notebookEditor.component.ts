/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, ChangeDetectorRef, forwardRef } from '@angular/core';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import * as notebookUtils from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { INotebookParams, INotebookService, INotebookManager, DEFAULT_NOTEBOOK_PROVIDER, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { CellMagicMapper } from 'sql/workbench/contrib/notebook/browser/models/cellMagicMapper';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILogService } from 'vs/platform/log/common/log';
import { IModelFactory, ViewMode, NotebookContentChange, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IAction, SubmenuAction } from 'vs/base/common/actions';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { INotebookView } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { Deferred } from 'sql/base/common/promise';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';

export const NOTEBOOKEDITOR_SELECTOR: string = 'notebookeditor-component';

@Component({
	selector: NOTEBOOKEDITOR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookEditor.component.html'))
})
export class NotebookEditorComponent extends AngularDisposable {
	private readonly defaultViewMode = ViewMode.Notebook;
	private profile: IConnectionProfile;
	private notebookManagers: INotebookManager[] = [];
	private _modelReadyDeferred = new Deferred<NotebookModel>();

	public model: NotebookModel;
	public views: NotebookViewsExtension;
	public activeView: INotebookView;
	public viewMode: ViewMode;
	public ViewMode = ViewMode;

	constructor(
		@Inject(ILogService) private readonly logService: ILogService,
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(ICapabilitiesService) private capabilitiesService: ICapabilitiesService,
		@Inject(IContextKeyService) private contextKeyService: IContextKeyService,
		@Inject(IMenuService) private menuService: IMenuService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IAdsTelemetryService) private adstelemetryService: IAdsTelemetryService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
	) {
		super();
		this.updateProfile();
	}
	ngOnInit() {
		this.doLoad().catch(e => onUnexpectedError(e));
	}

	private updateProfile(): void {
		this.profile = this._notebookParams ? this._notebookParams.profile : undefined;
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	private async doLoad(): Promise<void> {
		await this.createModelAndLoadContents();
		await this.setNotebookManager();
		await this.loadModel();

		this.setActiveView();
		this._modelReadyDeferred.resolve(this.model);
	}

	private async loadModel(): Promise<void> {
		// Wait on provider information to be available before loading kernel and other information
		await this.awaitNonDefaultProvider();
		await this.model.requestModelLoad();
		this.detectChanges();
		this.setContextKeyServiceWithProviderId(this.model.providerId);
		await this.model.startSession(this.model.notebookManager, undefined, true);
		this.fillInActionsForCurrentContext();
		this.detectChanges();
	}

	private async createModelAndLoadContents(): Promise<void> {
		let model = new NotebookModel({
			factory: this.modelFactory,
			notebookUri: this._notebookParams.notebookUri,
			connectionService: this.connectionManagementService,
			notificationService: this.notificationService,
			notebookManagers: this.notebookManagers,
			contentManager: this._notebookParams.input.contentManager,
			cellMagicMapper: new CellMagicMapper(this.notebookService.languageMagics),
			providerId: 'sql',
			defaultKernel: this._notebookParams.input.defaultKernel,
			layoutChanged: this._notebookParams.input.layoutChanged,
			capabilitiesService: this.capabilitiesService,
			editorLoadedTimestamp: this._notebookParams.input.editorOpenedTimestamp
		}, this.profile, this.logService, this.notificationService, this.adstelemetryService, this.connectionManagementService, this._configurationService, this.capabilitiesService);

		let trusted = await this.notebookService.isNotebookTrustCached(this._notebookParams.notebookUri, this.isDirty());
		this.model = this._register(model);
		await this.model.loadContents(trusted);

		this.views = new NotebookViewsExtension(this.model);
		this.viewMode = this.viewMode ?? this.defaultViewMode;

		this._register(model.viewModeChanged((mode) => this.onViewModeChanged()));
		this._register(model.contentChanged((change) => this.handleContentChanged(change)));
		this._register(model.onCellTypeChanged(() => this.detectChanges()));
		this._register(model.layoutChanged(() => this.detectChanges()));

		this.views.onViewDeleted(() => this.handleViewDeleted());
		this.views.onActiveViewChanged(() => this.handleActiveViewChanged());

		this.detectChanges();
	}

	private async setNotebookManager(): Promise<void> {
		let providerInfo = await this._notebookParams.providerInfo;
		for (let providerId of providerInfo.providers) {
			let notebookManager = await this.notebookService.getOrCreateNotebookManager(providerId, this._notebookParams.notebookUri);
			this.notebookManagers.push(notebookManager);
		}
	}

	private setContextKeyServiceWithProviderId(providerId: string) {
		let provider = new RawContextKey<string>('providerId', providerId);
		provider.bindTo(this.contextKeyService);
	}

	private async awaitNonDefaultProvider(): Promise<void> {
		// Wait on registration for now. Long-term would be good to cache and refresh
		await this.notebookService.registrationComplete;
		this.model.standardKernels = this._notebookParams.input.standardKernels;
		// Refresh the provider if we had been using default
		let providerInfo = await this._notebookParams.providerInfo;

		if (DEFAULT_NOTEBOOK_PROVIDER === providerInfo.providerId) {
			let providers = notebookUtils.getProvidersForFileName(this._notebookParams.notebookUri.fsPath, this.notebookService);
			let tsqlProvider = providers.find(provider => provider === SQL_NOTEBOOK_PROVIDER);
			providerInfo.providerId = tsqlProvider ? SQL_NOTEBOOK_PROVIDER : providers[0];
		}
	}

	/**
	 * Get all of the menu contributions that use the ID 'notebook/toolbar'.
	 * Then, find all groups (currently we don't leverage the contributed
	 * groups functionality for the notebook toolbar), and fill in the 'primary'
	 * array with items that don't list a group. Finally, add any actions from
	 * the primary array to the end of the toolbar.
	 */
	private fillInActionsForCurrentContext(): void {
		let primary: IAction[] = [];
		let secondary: IAction[] = [];
		let notebookBarMenu = this.menuService.createMenu(MenuId.NotebookToolbar, this.contextKeyService);
		let groups = notebookBarMenu.getActions({ arg: null, shouldForwardArgs: true });
		fillInActions(groups, { primary, secondary }, false, '', Number.MAX_SAFE_INTEGER, (action: SubmenuAction, group: string, groupSize: number) => group === undefined || group === '');
	}

	private get modelFactory(): IModelFactory {
		if (!this._notebookParams.modelFactory) {
			this._notebookParams.modelFactory = new ModelFactory(this.instantiationService);
		}
		return this._notebookParams.modelFactory;
	}

	private isDirty(): boolean {
		return this._notebookParams.input.isDirty();
	}

	public get modelReady(): Promise<INotebookModel> {
		return this._modelReadyDeferred.promise;
	}

	private handleContentChanged(change: NotebookContentChange) {
		// Note: for now we just need to set dirty state and refresh the UI.
		if (change.changeType === NotebookChangeType.MetadataChanged) {
			this.handleActiveViewChanged();
		}

		this.detectChanges();
	}

	private handleViewDeleted() {
		this.viewMode = this.model?.viewMode;
		this.detectChanges();
	}

	private handleActiveViewChanged() {
		this.setActiveView();
		this.detectChanges();
	}

	public onViewModeChanged(): void {
		this.viewMode = this.model?.viewMode;
		this.setActiveView();
		this.detectChanges();
	}

	public setActiveView() {
		const views = this.views.getViews();
		let activeView = this.views.getActiveView() ?? views[0];

		this.activeView = activeView;
	}
}
