/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import './notebookStyles';

import { nb } from 'sqlops';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild } from '@angular/core';

import URI from 'vs/base/common/uri';
import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { CellTypes, CellType } from 'sql/parts/notebook/models/contracts';
import { ICellModel, INotebookModel, IModelFactory, INotebookModelOptions } from 'sql/parts/notebook/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { INotebookService, INotebookParams, INotebookManager } from 'sql/services/notebook/notebookService';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { NotebookModel, ErrorInfo } from 'sql/parts/notebook/models/notebookModel';
import { ModelFactory } from 'sql/parts/notebook/models/modelFactory';
import * as notebookUtils from './notebookUtils';
import { Deferred } from 'sql/base/common/promise';

export const NOTEBOOK_SELECTOR: string = 'notebook-component';


@Component({
	selector: NOTEBOOK_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebook.component.html'))
})
export class NotebookComponent extends AngularDisposable implements OnInit {
	@ViewChild('toolbar', { read: ElementRef }) private toolbar: ElementRef;
	private _model: INotebookModel;
	private _isInErrorState: boolean = false;
	private _activeCell: ICellModel;
	protected isLoading: boolean;
	private notebookManager: INotebookManager;
	private _modelReadyDeferred = new Deferred<INotebookModel>();

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(INotebookService) private notebookService: INotebookService,
		@Inject(IBootstrapParams) private notebookParams: INotebookParams
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.doLoad();
	}

	protected get cells(): ReadonlyArray<ICellModel> {
		return this._model ? this._model.cells : [];
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbar.nativeElement;
		toolbarEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public selectCell(cell: ICellModel) {
		if (cell !== this._activeCell) {
			if (this._activeCell) {
				this._activeCell.active = false;
			}
			this._activeCell = cell;
			this._activeCell.active = true;
			this._changeRef.detectChanges();
		}
	}

	public onKeyDown(event) {
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				let nextIndex = (this.findCellIndex(this._activeCell) + 1)%this.cells.length;
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
			path: this.notebookParams.notebookUri.fsPath,
			connectionService: this.connectionManagementService,
			notificationService: this.notificationService,
			notebookManager: this.notebookManager
		}, false, undefined /* this.profile */);
		model.onError((errInfo: ErrorInfo) => this.handleModelError(errInfo));
		model.backgroundStartSession();
		await model.requestModelLoad(this.notebookOptions.isTrusted);
		model.contentChanged((change) => this.handleContentChanged(change));
		this._model = model;
		this._register(model);
		this._changeRef.detectChanges();
	}

	private get modelFactory(): IModelFactory {
		if (!this.notebookOptions.modelFactory) {
			this.notebookOptions.modelFactory = new ModelFactory();
		}
		return this.notebookOptions.modelFactory;
	}
	private handleModelError(errorInfo: ErrorInfo): void {
		let apiWrapper = this.notebookOptions.apiWrapper;
		switch (errorInfo.severity) {
			case MessageType.Error:
				if (this._model.inErrorState) {
					this.setViewInErrorState(errorInfo.message);
				} else {
					apiWrapper.showErrorMessage(errorInfo.message);
				}
				break;
			case MessageType.Warning:
				apiWrapper.showWarningMessage(errorInfo.message);
				break;
			default:
				apiWrapper.showInformationMessage(errorInfo.message);
		}
	}

	private handleContentChanged(change: NotebookContentChange) {
		switch(change.changeType) {
			case NotebookChangeType.CellsAdded:
				this.addCells(change);
				this.setDirty(true);
				break;
			case NotebookChangeType.CellDeleted:
				this.deleteCell(change);
				this.setDirty(true);
				break;
			case NotebookChangeType.DirtyStateChanged:
				this.setDirty(change.isDirty);
				break;
		}
	}

	findCellIndex(cellModel: ICellModel): number {
        return this.cells.findIndex((cell) => cell.id === cellModel.id);
	}

	private addCells(change: NotebookContentChange) {
		let newCells: ICellView[] = [];
		if (change.cells) {
			let cellArray = Array.isArray(change.cells) ? change.cells : [change.cells];
			newCells = cellArray.map(c => this.notebookOptions.viewModelFactory.createCellView(c));
			if (change.cellIndex !== undefined && change.cellIndex !== null && change.cellIndex >= 0 && change.cellIndex < this.cellList.length) {
				newCells.forEach((cell) => this.cellList.splice(change.cellIndex, 0, cell));
			}
			else {
				newCells.forEach((cell) => this.cellList.push(cell));
			}
		}
		this.addCellsToView(newCells, change.cellIndex);
	}

	private deleteCell(change: NotebookContentChange) {
		if (change.cellIndex >= 0 && change.cellIndex < this.cellList.length) {
			let cellView = this.cellList.splice(change.cellIndex, 1)[0];
			if (cellView) {
				this.ui.main.removeItem(cellView.viewComponent);
			}
		}
	}

	private ensureViewModelFactory(builder: sqlops.ModelBuilder): void {
		if (!this.notebookOptions.viewModelFactory) {
			this.notebookOptions.viewModelFactory = new ViewModelFactory(builder, this.notebookOptions.extensionContext);
		}
	}

	private setViewInErrorState(error: any): any {
		this._isInErrorState = true;
		this._errorMessage = notebookUtils.getErrorMessage(error);
		// For now, send message as error notification #870 covers having dedicated area for this
		this.notebookOptions.apiWrapper.showErrorMessage(error);
	}

	public async save(): Promise<boolean> {
		try {
			let saved = await this._model.saveModel();
			return saved;
		} catch (err) {
			this.notificationService.error(localize('saveFailed', 'Failed to save notebook: {0}', utils.getErrorMessage(err)));
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
