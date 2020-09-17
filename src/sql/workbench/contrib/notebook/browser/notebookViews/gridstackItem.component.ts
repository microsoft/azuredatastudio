/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter } from '@angular/core';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { ToggleMoreWidgetAction } from 'sql/workbench/contrib/dashboard/browser/core/actions';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Action, IAction } from 'vs/base/common/actions';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { HideCellAction } from 'sql/workbench/contrib/notebook/browser/notebookViews/actions';
import { NotebookViewExtension, INotebookViewCellMetadata, INotebookView, CellChangeEventType } from 'sql/workbench/services/notebook/browser/models/notebookView';


//declare var $: any; // JQuery

@Component({
	selector: 'gridstack-item',
	templateUrl: decodeURI(require.toUrl('./gridstackItem.component.html'))
})
export class GridStackItemComponent implements OnInit {
	private _actions: Array<Action>;
	private _actionbar: ActionBar;
	private _metadata: INotebookViewCellMetadata;
	private _activeView: INotebookView;

	@Input() cell: ICellModel;
	@Input() model: NotebookModel;
	@Input() extension: NotebookViewExtension;
	@Output() onChange: EventEmitter<any> = new EventEmitter();

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;

	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
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
	}

	initActionBar() {
		// top action bar
		this._actions = new Array<Action>();
		//this._actions.push(new HideCellAction(this.hide, this));
		if (this._actionbarRef) {
			let hideButton = new HideCellAction(this.hide, this);
			this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
			this._actionbar.context = { target: this._actionbarRef.nativeElement };
			this._actionbar.push(this.instantiationService.createInstance(ToggleMoreWidgetAction, this._actions as Array<IAction>, new CellContext(this.model, this.cell)), { icon: true, label: false });
			this._actionbar.push(hideButton, { icon: true });
		}
	}

	get elementRef(): ElementRef {
		return this._item;
	}

	changed(event: CellChangeEventType) {
		this.onChange.emit({ cell: this.cell, event: event });
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
