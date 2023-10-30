/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter, ChangeDetectorRef, forwardRef, SimpleChange } from '@angular/core';
import { CellExecutionState, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH, ViewsTab } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { CellChangeEventType, INotebookView, INotebookViewCard } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { RunCellAction, HideCellAction, ViewCellToggleMoreAction, ViewCellToggleMoreActionViewItem } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { cellBorder, notebookToolbarSelectBackground } from 'sql/platform/theme/common/colorRegistry';
import { TabComponent } from 'sql/base/browser/ui/panel/tab.component';
import { EDITOR_GROUP_HEADER_TABS_BACKGROUND, TAB_ACTIVE_BACKGROUND, TAB_BORDER, TAB_INACTIVE_BACKGROUND } from 'vs/workbench/common/theme';

@Component({
	selector: 'view-card-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCard.component.html'))
})
export class NotebookViewsCardComponent extends AngularDisposable implements OnInit {
	cell: ICellModel;

	private _actionbar: Taskbar;
	private _executionState: CellExecutionState;
	private _pendingReinitialize: boolean = false;

	@Input() card: INotebookViewCard;
	@Input() cells: ICellModel[];
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() activeTab: ViewsTab;
	@Input() meta: boolean;
	@Input() ready: boolean;
	@Output() onChange: EventEmitter<any> = new EventEmitter();

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
	) {
		super();
	}

	ngOnInit() {
		this.initialize();
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		this.detectChanges();
	}

	ngAfterViewInit() {
		this.detectChanges();
	}

	ngAfterViewChecked() {
		if (this._pendingReinitialize) {
			this._pendingReinitialize = false;
			this.initialize();
		}
	}

	handleTabChange(selectedTab: TabComponent) {
		const tab = this.tabs.find(t => t.id === selectedTab.identifier);
		if (tab && this.cell?.cellGuid !== tab.cell?.guid) {
			this.cell = this.cells.find(c => c.cellGuid === tab.cell.guid);
			this.model.updateActiveCell(this.cell);
			this.changed('active');

			this.initActionBar();
		}
	}

	handleTabClose(selectedTab: TabComponent) {
		const tab = this.tabs.find(t => t.id === selectedTab.identifier);
		if (tab) {
			const cell = this.cells.find(c => c.cellGuid === tab.cell.guid);
			if (cell) {
				this.activeView.hideCell(cell);
			}
		}
	}

	override ngOnDestroy() {
		if (this._actionbar) {
			this._actionbar.dispose();
		}
	}

	public initialize(): void {
		this.initActionBar();
		if (this.card.activeTab !== undefined) {
			this.cell = this.cells.find(c => c.cellGuid === this.card.activeTab.cell.guid);
		}

		this.detectChanges();
	}

	public get tabs(): ViewsTab[] {
		return this.card?.tabs ?? [];
	}

	initActionBar() {
		if (this._actionbarRef) {
			let taskbarContent: ITaskbarContent[] = [];
			let context = new CellContext(this.model, this.cell);

			if (this._actionbar) {
				this._actionbar.dispose();
			}

			this._actionbar = new Taskbar(this._actionbarRef.nativeElement, {
				actionViewItemProvider: action => {
					if (action.id === ViewCellToggleMoreAction.ID) {
						return this._instantiationService.createInstance(ViewCellToggleMoreActionViewItem, action, this._actionbar.actionRunner, context);
					}
					return undefined;
				}
			});
			this._actionbar.context = { target: this._actionbarRef.nativeElement };

			if (this.cell.cellType === CellTypes.Code) {
				let runCellAction = this._instantiationService.createInstance(RunCellAction, context);
				taskbarContent.push({ action: runCellAction });
			}

			let hideButton = new HideCellAction(this.hide, this);
			taskbarContent.push({ action: hideButton });

			const viewCellToggleMoreAction = this._instantiationService.createInstance(ViewCellToggleMoreAction);
			taskbarContent.push({ action: viewCellToggleMoreAction });

			this._actionbar.setContent(taskbarContent);
		}
	}

	get elementRef(): ElementRef {
		return this._item;
	}


	changed(event: CellChangeEventType) {
		this.onChange.emit({ cell: this.cell, event: event });
	}


	get displayInputModal(): boolean {
		return this.awaitingInput;
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

	public set executionState(state: CellExecutionState) {
		if (this._executionState !== state) {
			this._executionState = state;
		}
	}

	public get executionState(): CellExecutionState {
		return this._executionState;
	}

	public hide(): void {
		this.changed('hide');
	}


	public get metadata(): INotebookViewCard {
		return this.card;
	}

	public get guid(): string {
		return this.metadata.guid;
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

	/**
	 * Whether to display the card
	 */
	public get visible(): boolean {
		if (!this.activeView) {
			return true;
		}

		if (!this.cell) { //Means not initialized
			return false;
		}

		return !!this.activeView.displayedCells.find(c => c.cellGuid === this.cell.cellGuid);
	}

	/**
	 * Is the cell expecting input
	 */
	public get awaitingInput(): boolean {
		return this.cell.future && this.cell.future.inProgress;
	}

	public get showActionBar(): boolean {
		return this.cell.active;
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const cellBorderColor = theme.getColor(cellBorder);
	if (cellBorderColor) {
		collector.addRule(`.notebookEditor .nb-grid-stack .actionbar { border-color: ${cellBorderColor};}`);
		collector.addRule(`.notebookEditor .nb-grid-stack .actionbar .codicon:before { background-color: ${cellBorderColor};}`);
	}

	// Cell toolbar background
	const notebookToolbarSelectBackgroundColor = theme.getColor(notebookToolbarSelectBackground);
	if (notebookToolbarSelectBackgroundColor) {
		collector.addRule(`.notebookEditor .nb-grid-stack .notebook-cell.active .actionbar { background-color: ${notebookToolbarSelectBackgroundColor};}`);
	}


	const tabBorder = theme.getColor(TAB_BORDER);
	const tabBackground = theme.getColor(TAB_INACTIVE_BACKGROUND);
	const tabActiveBackground = theme.getColor(TAB_ACTIVE_BACKGROUND);

	const headerBackground = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
	if (headerBackground) {
		collector.addRule(`
			.notebook-cell .grid-stack-header {
				background-color: ${headerBackground.toString()};
			}
		`);
	}

	if (tabBackground && tabBorder) {
		collector.addRule(`
		.notebook-cell .tabbedPanel.horizontal > .title .tabList {
			border-color: ${tabBorder.toString()};
			background-color: ${tabBackground.toString()};
		}

		.notebook-cell .tabbedPanel.horizontal > .title .tabList .tab-header {
			border-right: 1px solid ${tabBorder.toString()};
			background-color: ${tabBackground.toString()};
			margin: 0;
		}

		.notebook-cell .tabbedPanel.horizontal > .title .tabList a.action-label.codicon.close {
			background-size: 9px 9px !important;
			margin-top: -1px;
		}

		.notebook-cell .tabbedPanel.horizontal > .title .tabList .actions-container {
			margin-right: 0px;
			margin-left: 8px;
		}
		`);
	}

	if (tabActiveBackground) {
		collector.addRule(`
		.notebook-cell .tabbedPanel.horizontal > .title .tabList .tab-header.active {
			background-color: ${tabActiveBackground.toString()};
		}
		`);
	}
});
