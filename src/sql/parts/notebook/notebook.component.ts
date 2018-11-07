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
import { INotificationService, INotification } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { CellTypes, CellType, NotebookChangeType } from 'sql/parts/notebook/models/contracts';
import { ICellModel, INotebookModel, IModelFactory, INotebookModelOptions } from 'sql/parts/notebook/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { INotebookService, INotebookParams, INotebookManager } from 'sql/services/notebook/notebookService';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { NotebookModel, ErrorInfo, MessageLevel, NotebookContentChange } from 'sql/parts/notebook/models/notebookModel';
import { ModelFactory } from 'sql/parts/notebook/models/modelFactory';
import * as notebookUtils from './notebookUtils';
import { Deferred } from 'sql/base/common/promise';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

export const NOTEBOOK_SELECTOR: string = 'notebook-component';

<<<<<<< HEAD
class CellModelStub implements ICellModel {
	public cellUri: URI;
	constructor(public id: string,
		public language: string,
		public source: string,
		public cellType: CellType,
		public trustedMode: boolean = false,
		public active: boolean = false,
		public outputs: ReadonlyArray<nb.ICellOutput> = undefined
	) { }

	equals(cellModel: ICellModel): boolean {
		throw new Error('Method not implemented.');
	}
	toJSON(): nb.ICell {
		throw new Error('Method not implemented.');
	}
}
=======
>>>>>>> origin/feature/nativeNotebook

@Component({
	selector: NOTEBOOK_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebook.component.html'))
})
export class NotebookComponent extends AngularDisposable implements OnInit {
	@ViewChild('toolbar', { read: ElementRef }) private toolbar: ElementRef;
	private _model: NotebookModel;
	private _isInErrorState: boolean = false;
	private _errorMessage: string;
	private _activeCell: ICellModel;
	protected isLoading: boolean;
	private notebookManager: INotebookManager;
	private _modelReadyDeferred = new Deferred<NotebookModel>();
	private profile: IConnectionProfile;


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
<<<<<<< HEAD

		// TODO NOTEBOOK REFACTOR: This is mock data for cells. Will remove this code when we have a service
		let output1: nb.IDisplayResult ={
			output_type: 'display_data',
			data: {
				'text/plain': [
				 '<IPython.core.display.HTML object>'
				]
			}
		}
		let cell1 : ICellModel = new CellModelStub ('1', 'sql', 'select * from sys.tables', CellTypes.Code, false, false, [output1]);
		let output2: nb.IStreamResult = {
			output_type: 'stream',
			name: 'stdout',
			text: 'hello world'
		};
		let cell2 : ICellModel = new CellModelStub ('2', 'sql', 'select 1', CellTypes.Code, false, false, [output2]);
		let cell3 : ICellModel = new CellModelStub ('3', 'markdown', '## This is test!', CellTypes.Markdown);
		this.cells.push(cell1, cell2, cell3);
=======
		this.profile = this.notebookParams!.profile;
		this.isLoading = true;
>>>>>>> origin/feature/nativeNotebook
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
		}, false, this.profile);
		model.onError((errInfo: INotification) => this.handleModelError(errInfo));
		model.backgroundStartSession();
		await model.requestModelLoad(this.notebookParams.isTrusted);
		model.contentChanged((change) => this.handleContentChanged(change));
		this._model = model;
		this._register(model);
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
