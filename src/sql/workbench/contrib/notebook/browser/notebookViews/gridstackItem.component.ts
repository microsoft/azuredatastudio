/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter, ChangeDetectorRef, forwardRef } from '@angular/core';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { HideCellAction, RunCellAction } from 'sql/workbench/contrib/notebook/browser/notebookViews/actions';
import { NotebookViewExtension, INotebookViewCellMetadata, INotebookView, CellChangeEventType } from 'sql/workbench/services/notebook/browser/models/notebookView';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';


//declare var $: any; // JQuery

@Component({
	selector: 'gridstack-item',
	templateUrl: decodeURI(require.toUrl('./gridstackItem.component.html'))
})
export class GridStackItemComponent implements OnInit {
	//private _actions: Array<Action>;
	private _actionbar: ActionBar;
	private _metadata: INotebookViewCellMetadata;
	private _activeView: INotebookView;

	@Input() cell: ICellModel;
	@Input() model: NotebookModel;
	@Input() extension: NotebookViewExtension;
	@Input() ready: boolean;
	@Output() onChange: EventEmitter<any> = new EventEmitter();

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
	) { }

	ngOnInit() {
		this.initActionBar();
	}

	ngOnChanges() {
		if (this.extension) {
			this._activeView = this.extension.getActiveView();
			this._metadata = this.extension.getCellMetadata(this.cell);
		}
	}

	ngAfterContentInit() {
		if (this.extension) {
			this._activeView = this.extension.getActiveView();
			this._metadata = this.extension.getCellMetadata(this.cell);
		}
	}

	ngAfterViewInit() {
		this.initActionBar();
		this.detectChanges();
	}

	initActionBar() {
		// top action bar
		//this._actions = new Array<Action>();
		if (this._actionbarRef) {
			let context = new CellContext(this.model, this.cell);

			this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
			this._actionbar.context = { target: this._actionbarRef.nativeElement };

			if (this.cell.cellType === CellTypes.Code) {
				let runCellAction = this._instantiationService.createInstance(RunCellAction, context);
				this._actionbar.push(runCellAction, { icon: true });
			}

			let hideButton = new HideCellAction(this.hide, this);
			this._actionbar.push(hideButton, { icon: true });
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

	public get width(): number {
		return this.cell.metadata?.extensions?.azuredatastudio?.views[0]?.width ? this.cell.metadata.extensions.azuredatastudio.views[0].width : 12;
	}

	public get height(): number {
		return this.cell.metadata?.extensions?.azuredatastudio?.views[0]?.height ? this.cell.metadata.extensions.azuredatastudio.views[0].height : 4;
	}

	public get x(): number {
		return this.cell.metadata?.extensions?.azuredatastudio?.views[0]?.x;
	}

	public get y(): number {
		return this.cell.metadata?.extensions?.azuredatastudio?.views[0]?.y;
	}

	public get display(): boolean {
		if (!this._metadata || !this._activeView) {
			return true;
		}

		return !this._metadata?.views?.find(v => v.guid === this._activeView.guid).hidden;
	}

	public get showActionBar(): boolean {
		return this.cell.active;
	}
}
