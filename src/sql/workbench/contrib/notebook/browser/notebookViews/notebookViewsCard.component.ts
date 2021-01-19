/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter, ChangeDetectorRef, forwardRef } from '@angular/core';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellChangeEventType, INotebookView, INotebookViewCellMetadata } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

@Component({
	selector: 'view-card-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCard.component.html'))
})
export class NotebookViewsCardComponent implements OnInit {
	private _metadata: INotebookViewCellMetadata;
	private _activeView: INotebookView;

	@Input() cell: ICellModel;
	@Input() model: NotebookModel;
	@Input() views: NotebookViewsExtension;
	@Input() ready: boolean;
	@Output() onChange: EventEmitter<any> = new EventEmitter();

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) { }

	ngOnInit() { }

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
		if (event) {
			event.stopPropagation();
		}
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
