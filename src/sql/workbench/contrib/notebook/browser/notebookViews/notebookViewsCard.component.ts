/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import * as DOM from 'vs/base/browser/dom';
import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter, ChangeDetectorRef, forwardRef } from '@angular/core';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellChangeEventType, INotebookView, INotebookViewCellMetadata } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { RunCellAction, HideCellAction, ViewCellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';

@Component({
	selector: 'view-card-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCard.component.html'))
})
export class NotebookViewsCardComponent implements OnInit {
	public _cellToggleMoreActions: ViewCellToggleMoreActions;

	private _actionbar: Taskbar;
	private _metadata: INotebookViewCellMetadata;
	private _activeView: INotebookView;

	@Input() cell: ICellModel;
	@Input() model: NotebookModel;
	@Input() views: NotebookViewsExtension;
	@Input() ready: boolean;
	@Output() onChange: EventEmitter<any> = new EventEmitter();

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService
	) { }

	ngOnInit() {
		this.initActionBar();
	}

	ngOnChanges() {
		if (this.views) {
			this._activeView = this.views.getActiveView();
			this._metadata = this.views.getCellMetadata(this.cell);
		}
	}

	ngAfterContentInit() {
		if (this.views) {
			this._activeView = this.views.getActiveView();
			this._metadata = this.views.getCellMetadata(this.cell);
		}
	}

	ngAfterViewInit() {
		this.detectChanges();
	}

	initActionBar() {
		if (this._actionbarRef) {
			let taskbarContent: ITaskbarContent[] = [];
			let context = new CellContext(this.model, this.cell);

			this._actionbar = new Taskbar(this._actionbarRef.nativeElement);
			this._actionbar.context = { target: this._actionbarRef.nativeElement };

			if (this.cell.cellType === CellTypes.Code) {
				let runCellAction = this._instantiationService.createInstance(RunCellAction, context);
				taskbarContent.push({ action: runCellAction });
			}

			let hideButton = new HideCellAction(this.hide, this);
			taskbarContent.push({ action: hideButton });

			let moreActionsContainer = DOM.$('li.action-item');
			this._cellToggleMoreActions = this._instantiationService.createInstance(ViewCellToggleMoreActions);
			this._cellToggleMoreActions.onInit(moreActionsContainer, context);
			taskbarContent.push({ element: moreActionsContainer });

			this._actionbar.setContent(taskbarContent);
		}
	}

	get elementRef(): ElementRef {
		return this._item;
	}

	changed(event: CellChangeEventType) {
		this.onChange.emit({ cell: this.cell, event: event });
	}

	detectChanges() {
		this._changeRef.detectChanges();
	}

	public selectCell(cell: ICellModel, event?: Event) {
		event?.stopPropagation();

		if (!this.model.activeCell || this.model.activeCell.id !== cell.id) {
			this.model.updateActiveCell(cell);
			this.changed('active');
		}
	}

	public hide(): void {
		this.changed('hide');
	}

	public get data(): any {
		return this._metadata?.views?.find(v => v.guid === this._activeView.guid);
	}

	public get width(): number {
		return this.data?.width ? this.data.width : DEFAULT_VIEW_CARD_WIDTH;
	}

	public get height(): number {
		return this.data.height ? this.data.height : DEFAULT_VIEW_CARD_HEIGHT;
	}

	public get x(): number {
		return this.data?.x;
	}

	public get y(): number {
		return this.data?.y;
	}

	public get display(): boolean {
		if (!this._metadata || !this._activeView) {
			return true;
		}

		return !this.data?.hidden;
	}

	public get showActionBar(): boolean {
		return this.cell.active;
	}
}
