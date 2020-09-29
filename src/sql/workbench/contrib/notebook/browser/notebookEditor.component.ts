/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, ChangeDetectorRef, forwardRef } from '@angular/core';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { INotebookParams, INotebookService, INotebookManager } from 'sql/workbench/services/notebook/browser/notebookService';
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
import { INotebookView, NotebookViewExtension } from 'sql/workbench/services/notebook/browser/models/notebookView';
import { Deferred } from 'sql/base/common/promise';

export const NOTEBOOKEDITOR_SELECTOR: string = 'notebookeditor-component';

@Component({
	selector: NOTEBOOKEDITOR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookEditor.component.html'))
})
export class NotebookEditorComponent extends AngularDisposable {
	private profile: IConnectionProfile;
	private notebookManagers: INotebookManager[] = [];
	private _modelReadyDeferred = new Deferred<NotebookModel>();

	public model: NotebookModel;
	public extension: NotebookViewExtension;
	public activeView: INotebookView;
	public viewMode: ViewMode;

	constructor(
		@Inject(ILogService) private readonly logService: ILogService,
		@Inject(IBootstrapParams) private _notebookParams: INotebookParams,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(ICapabilitiesService) private capabilitiesService: ICapabilitiesService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IAdsTelemetryService) private adstelemetryService: IAdsTelemetryService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
	) {
		super();
	}
	ngOnInit() {
		this.doLoad().catch(e => onUnexpectedError(e));
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	private async doLoad(): Promise<void> {
		await this.createModelAndLoadContents();
		this._modelReadyDeferred.resolve(this.model);
		this.setActiveView();
		this.setNotebookManager();
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
		}, this.profile, this.logService, this.notificationService, this.adstelemetryService, this.capabilitiesService);

		let trusted = await this.notebookService.isNotebookTrustCached(this._notebookParams.notebookUri, this.isDirty());

		this.model = this._register(model);
		await this.model.loadContents(trusted);

		this.extension = new NotebookViewExtension(this.model);
		this.viewMode = this.model.viewMode || ViewMode.Notebook;

		this._register(this.extension.onViewDeleted((view) => this.handleViewDeleted(view)));
		this._register(model.viewModeChanged((mode) => this.onViewModeChanged()));
		this._register(model.contentChanged((change) => this.handleContentChanged(change)));
		this._register(model.onCellTypeChanged(() => this.detectChanges()));
		this._register(model.layoutChanged(() => this.detectChanges()));

		this.detectChanges();
	}

	private async setNotebookManager(): Promise<void> {
		let providerInfo = await this._notebookParams.providerInfo;
		for (let providerId of providerInfo.providers) {
			let notebookManager = await this.notebookService.getOrCreateNotebookManager(providerId, this._notebookParams.notebookUri);
			this.notebookManagers.push(notebookManager);
		}
	}

	private get modelFactory(): IModelFactory {
		if (!this._notebookParams.modelFactory) {
			this._notebookParams.modelFactory = new ModelFactory(this.instantiationService);
		}
		return this._notebookParams.modelFactory;
	}

	isDirty(): boolean {
		return this._notebookParams.input.isDirty();
	}

	public get modelReady(): Promise<INotebookModel> {
		return this._modelReadyDeferred.promise;
	}

	private handleContentChanged(change: NotebookContentChange) {
		this.setActiveView();

		// Note: for now we just need to set dirty state and refresh the UI.
		this.detectChanges();
	}

	private handleViewDeleted(view: INotebookView) {
		this.viewMode = ViewMode.Notebook;
		this.detectChanges();
	}

	public onViewModeChanged(): void {
		this.viewMode = this.model?.viewMode;
		this.setActiveView();
		this.detectChanges();
	}

	public setActiveView() {
		const views = this.extension.getViews();
		let activeView = this.extension.getActiveView() ?? views[0];

		this.activeView = activeView;

	}
}
