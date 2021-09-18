/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookView, INotebookViewCard, INotebookViewsTab } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookViewsCardTabComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCardTab.components';
import { LocalSelectionTransfer } from 'vs/workbench/browser/dnd';

@Component({
	selector: 'view-card-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCard.component.html'))
})
export class NotebookViewsCardComponent extends AngularDisposable implements OnInit {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() ready: boolean;
	@Input() cells: ICellModel[];
	@Input() card: INotebookViewCard;
	@Input() tabTransfer: LocalSelectionTransfer<NotebookViewsCardTabComponent>;

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;

	private _activeTab: INotebookViewsTab;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		this.initialize();
	}

	ngAfterViewInit(): void {
		//this.initialize();
	}

	public initialize(): void {
		/*
		if(this.card.guid === '1') {
			this._tabs = this.cells.slice(0, 2).map((cell) => ({ title: `Tab ${cell.id}`, guid: cell.cellGuid, cell }));
		}

		if(this.card.guid === '2') {
			this._tabs = this.cells.slice(2).map((cell) => ({ title: `Tab ${cell.id}`, guid: cell.cellGuid, cell }));
		}
		*/

		this._activeTab = this.tabs[0];

		this.detectChanges();
	}

	ngAfterContentInit() {
		this.detectChanges();
	}

	ngOnChanges() {
		this.detectChanges();
	}

	get elementRef(): ElementRef {
		return this._item;
	}

	public get tabs(): INotebookViewsTab[] {
		return this.card.tabs;
	}

	public get activeTab(): INotebookViewsTab {
		return this._activeTab;
	}

	public get cell(): ICellModel {
		return this.activeTab?.cell;
	}

	public get metadata(): INotebookViewCard {
		return this.card;
	}

	public get width(): number {
		return this.metadata?.width ? this.metadata.width : DEFAULT_VIEW_CARD_WIDTH;
	}

	public get height(): number {
		return this.metadata?.height ? this.metadata.height : DEFAULT_VIEW_CARD_HEIGHT;
	}

	public get x(): number {
		return this.metadata?.x;
	}

	public get y(): number {
		return this.metadata?.y;
	}

	public get visible(): boolean {
		if (!this.activeView) {
			return true;
		}
		if (!this.metadata) { //Means not initialized
			return false;
		}
		return true;
	}

	public detectChanges() {
		this._changeRef.detectChanges();
	}
}
