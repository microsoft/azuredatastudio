/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import './notebookStyles';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild } from '@angular/core';

import * as themeColors from 'vs/workbench/common/theme';
import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { INotificationService, INotification } from 'vs/platform/notification/common/notification';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ICellModel, IModelFactory } from 'sql/parts/notebook/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { INotebookService, INotebookParams, INotebookManager } from 'sql/services/notebook/notebookService';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { NotebookModel, ErrorInfo, MessageLevel, NotebookContentChange } from 'sql/parts/notebook/models/notebookModel';
import { ModelFactory } from 'sql/parts/notebook/models/modelFactory';
import { Deferred } from 'sql/base/common/promise';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { AttachToDropdown, KernelsDropdown } from 'sql/parts/notebook/notebookActions';
import * as notebookUtils from './notebookUtils';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { KernelsDropdown, AttachToDropdown, AddCellAction } from 'sql/parts/notebook/notebookActions';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';

export const NOTEBOOK_SELECTOR: string = 'notebook-component';


@Component({
	selector: NOTEBOOK_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebook.component.html'))
})
export class NotebookComponent extends AngularDisposable implements OnInit {
	@ViewChild('toolbar', { read: ElementRef }) private toolbar: ElementRef;
	private _model: NotebookModel;
	private _isInErrorState: boolean = false;
	private _errorMessage: string;
	protected _actionBar: Taskbar;
	private _activeCell: ICellModel;
	protected isLoading: boolean;
	private notebookManager: INotebookManager;
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private _modelRegisteredDeferred = new Deferred<NotebookModel>();
	private profile: IConnectionProfile;


	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(IBootstrapParams) private notebookParams: INotebookParams,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super();
		this.profile = this.notebookParams!.profile;
		this.isLoading = true;
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.initActionBar();
		this.doLoad();
	}

	public get modelRegistered(): Promise<NotebookModel> {
		return this._modelRegisteredDeferred.promise;
	}

	protected get cells(): ReadonlyArray<ICellModel> {
		return this._model ? this._model.cells : [];
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbar.nativeElement;
		toolbarEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public selectCell(cell: ICellModel) {
		if (cell !
        
        this._activeCell) {
			if (this._activeCell) {
				this._activeCell.active = false;
			}
			this._activeCell = cell;
			this._activeCell.active = true;
			this._changeRef.detectChanges();
		}
	}

	//Add cell based on cell type
	public addCell(cellType: CellType)
	{
		this._model.addCell(cellType);
	}

	public onKeyDown(event) {
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				let nextIndex = (this.findCellIndex(this._activeCell) + 1) % this.cells.length;
				this.selectCell(this.cells[nextIndex]);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				let index = this.findCellIndex(this._activeCell);
				if (index === 0) {
					index = this.cells.length;
				}
				this.selectCell(this.cells[--index]);
				break;
			default:
				break;
		}
	}

	private async doLoad(): Promise<void> {
		try {
			await this.loadModel();
			this.setLoading(false);
			this._modelReadyDeferred.resolve(this._model);
		} catch (error) {
			this.setViewInErrorState(localize('displayFailed', 'Could not display contents: {0}', error));
			this.setLoading(false);
			this._modelReadyDeferred.reject(error);
		}
	}

	private setLoading(isLoading: boolean): void {
		this.isLoading = isLoading;
		this._changeRef.detectChanges();
	}

	private async loadModel(): Promise<void> {
		this.notebookManager = await this.notebookService.getOrCreateNotebookManager(this.notebookParams.providerId, this.notebookParams.notebookUri);
		let model = new NotebookModel({
			factory: this.modelFactory,
			notebookUri: this.notebookParams.notebookUri,
			connectionService: this.connectionManagementService,
			notificationService: this.notificationService,
			notebookManager: this.notebookManager
		}, false, this.profile);
		model.onError((errInfo: INotification) => this.handleModelError(errInfo));
		await model.requestModelLoad(this.notebookParams.isTrusted);
		model.contentChanged((change) => this.handleContentChanged(change));
		this._model = model;
		this._register(model);
		this._modelRegisteredDeferred.resolve(this._model);
		model.backgroundStartSession();
		this._changeRef.detectChanges();
	}

	private get modelFactory(): IModelFactory {
		if (!this.notebookParams.modelFactory) {
			this.notebookParams.modelFactory = new ModelFactory();
		}
		return this.notebookParams.modelFactory;
	}
	private handleModelError(notification: INotification): void {
		this.notificationService.notify(notification);
	}

	private handleContentChanged(change: NotebookContentChange) {
		// Note: for now we just need to set dirty state and refresh the UI.
		this.setDirty(true);
		this._changeRef.detectChanges();
	}

	findCellIndex(cellModel: ICellModel): number {
		return this._model.cells.findIndex((cell) => cell.id === cellModel.id);
	}

	private setViewInErrorState(error: any): any {
		this._isInErrorState = true;
		this._errorMessage = notebookUtils.getErrorMessage(error);
		// For now, send message as error notification #870 covers having dedicated area for this
		this.notificationService.error(error);
	}

	protected initActionBar() {
		let kernelContainer = document.createElement('div');
		let kernelDropdown = new KernelsDropdown(kernelContainer, this.contextViewService, this.modelRegistered);
		kernelDropdown.render(kernelContainer);
		attachSelectBoxStyler(kernelDropdown, this.themeService);

		let attachToContainer = document.createElement('div');
		let attachTodropdwon = new AttachToDropdown(attachToContainer, this.contextViewService);
		attachTodropdwon.render(attachToContainer);
		attachSelectBoxStyler(attachTodropdwon, this.themeService);

		let addCodeCellButton = new AddCellAction('notebook.AddCodeCell', localize('code', 'Code'), 'notebook-info-button');
		addCodeCellButton.cellType = CellTypes.Code;

		let addTextCellButton = new AddCellAction('notebook.AddTextCell',localize('text', 'Text'), 'notebook-info-button');
		addTextCellButton.cellType = CellTypes.Markdown;

		let taskbar = <HTMLElement>this.toolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar, this.contextMenuService);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ element: kernelContainer },
			{ element: attachToContainer }
			{ action: addCodeCellButton},
			{ action: addTextCellButton}
		]);
	}

	public async save(): Promise<boolean> {
		try {
			let saved = await this._model.saveModel();
			return saved;
		} catch (err) {
			this.notificationService.error(localize('saveFailed', 'Failed to save notebook: {0}', notebookUtils.getErrorMessage(err)));
			return false;
		}
	}

	private setDirty(isDirty: boolean): void {
		// TODO reenable handling of isDirty
		// if (this.editor) {
		//     this.editor.isDirty = isDirty;
		// }
	}


}
