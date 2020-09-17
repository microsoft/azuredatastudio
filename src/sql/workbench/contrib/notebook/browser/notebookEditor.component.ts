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
import { IModelFactory, ViewMode, NotebookContentChange } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { onUnexpectedError } from 'vs/base/common/errors';
import { NotebookViewExtension, INotebookView } from 'sql/workbench/services/notebook/browser/models/notebookView';

export const NOTEBOOKEDITOR_SELECTOR: string = 'notebookeditor-component';

@Component({
	selector: NOTEBOOKEDITOR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookEditor.component.html'))
})
export class NotebookEditorComponent extends AngularDisposable {
	private _model: NotebookModel;
	private profile: IConnectionProfile;
	private notebookManagers: INotebookManager[] = [];

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
		}, this.profile, this.logService, this.notificationService, this.adstelemetryService);


		this._model = this._register(model);
		this._model.viewModeChanged((mode) => this.onViewModeChanged());
		this._register(this._model.contentChanged((change) => this.handleContentChanged(change)));
		this.detectChanges();
	}

	private get modelFactory(): IModelFactory {
		if (!this._notebookParams.modelFactory) {
			this._notebookParams.modelFactory = new ModelFactory(this.instantiationService);
		}
		return this._notebookParams.modelFactory;
	}

	public get model() {
		return this._model;
	}

	private handleContentChanged(change: NotebookContentChange) {
		// Note: for now we just need to set dirty state and refresh the UI.
		this.detectChanges();
	}

	public onViewModeChanged() {
		this.detectChanges();
	}

	public notebookMode(): boolean {
		return this._model.viewMode === ViewMode.Notebook || this._model.viewMode === undefined;
	}

	public notebookViewsMode(): boolean {
		return this._model.viewMode === ViewMode.Views;
	}

	public get activeView(): INotebookView {
		const extension = new NotebookViewExtension(this.model);
		const views = extension.getViews();
		let activeView = extension.getActiveView() ?? views[0];

		if (!activeView) {
			activeView = extension.createNewView('New View');
			extension.setActiveView(activeView);
			extension.commit();
		}

		return activeView;

	}
}
