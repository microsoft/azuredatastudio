/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import * as DOM from 'vs/base/browser/dom';
import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter, ChangeDetectorRef, forwardRef, SimpleChanges } from '@angular/core';
import { CellExecutionState, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { CellChangeEventType, INotebookView, INotebookViewCell } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { RunCellAction, HideCellAction, ViewCellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { cellBorder, notebookToolbarSelectBackground } from 'sql/platform/theme/common/colorRegistry';

@Component({
	selector: 'view-card-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCard.component.html'))
})
export class NotebookViewsCardComponent extends AngularDisposable implements OnInit {
	private _actionbar: Taskbar;
	private _metadata: INotebookViewCell;
	private _executionState: CellExecutionState;
	private _pendingReinitialize: boolean = false;

	public _cellToggleMoreActions: ViewCellToggleMoreActions;

	@Input() cell: ICellModel;
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
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

	ngOnChanges(changes: SimpleChanges) {
		if (this.activeView && changes['activeView'] && changes['activeView'].currentValue?.guid !== changes['activeView'].previousValue?.guid) {
			this._metadata = this.activeView.getCellMetadata(this.cell);
			this._pendingReinitialize = true;
		}
		this.detectChanges();
	}

	ngAfterContentInit() {
		if (this.activeView) {
			this._metadata = this.activeView.getCellMetadata(this.cell);
			this._pendingReinitialize = true;
		}
		this.detectChanges();
	}

	ngAfterViewChecked() {
		if (this._pendingReinitialize) {
			this._pendingReinitialize = false;
			this.initialize();
		}
	}

	override ngOnDestroy() {
		if (this._actionbar) {
			this._actionbar.dispose();
		}
	}

	public initialize(): void {
		this.initActionBar();
		this.detectChanges();
	}

	initActionBar() {
		if (this._actionbarRef) {
			let taskbarContent: ITaskbarContent[] = [];
			let context = new CellContext(this.model, this.cell);

			if (this._actionbar) {
				this._actionbar.dispose();
			}

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

	public get metadata(): INotebookViewCell {
		return this._metadata;
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

		if (!this._metadata) { //Means not initialized
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
		collector.addRule(`.notebookEditor .nb-grid-stack .notebook-cell.active .actionbar { border-color: ${cellBorderColor};}`);
		collector.addRule(`.notebookEditor .nb-grid-stack .notebook-cell.active .actionbar .codicon:before { background-color: ${cellBorderColor};}`);
	}

	// Cell toolbar background
	const notebookToolbarSelectBackgroundColor = theme.getColor(notebookToolbarSelectBackground);
	if (notebookToolbarSelectBackgroundColor) {
		collector.addRule(`.notebookEditor .nb-grid-stack .notebook-cell.active .actionbar { background-color: ${notebookToolbarSelectBackgroundColor};}`);
	}
});
