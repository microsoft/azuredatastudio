/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import 'vs/css!./notebookViewsCardTabs';
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnInit, SimpleChange, TemplateRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookView, INotebookViewCard, INotebookViewsTab } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookViewsCardTabComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCardTab.component';
import { LocalSelectionTransfer } from 'vs/workbench/browser/dnd';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { TAB_BORDER, EDITOR_GROUP_HEADER_TABS_BACKGROUND } from 'vs/workbench/common/theme';

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
	@Input() activeTab: INotebookViewsTab;
	@Input() tabTransfer: LocalSelectionTransfer<NotebookViewsCardTabComponent>;

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;

	cell: ICellModel;

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
		if (this.card.activeTab === undefined) {
			this.card.activeTab = this.tabs[0];
			this.cell = this.cells.find(c => c.cellGuid === this.card.activeTab.cell.guid);
		} else {
			this.cell = this.cells.find(c => c.cellGuid === this.card.activeTab.cell.guid);
		}

		this.detectChanges();
	}

	ngAfterContentInit() {
		this.detectChanges();
	}

	handleTabSelected(selectedTab: INotebookViewsTab) {
		this.cell = undefined;
		this.detectChanges();
		this.cell = this.cells.find(c => c.cellGuid === selectedTab.cell.guid);
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		this.detectChanges();
	}

	get elementRef(): ElementRef {
		return this._item;
	}

	public get tabs(): INotebookViewsTab[] {
		return this.card?.tabs ?? [];
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

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const background = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
	const border = theme.getColor(TAB_BORDER);

	if (background && border) {
		collector.addRule(`
		.notebook-card .tabs-and-actions-container {
			border-color: ${border.toString()};
			background-color: ${background.toString()};
		}
		`);
	}
});
