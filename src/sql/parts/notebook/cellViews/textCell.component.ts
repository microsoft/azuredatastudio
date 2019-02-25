/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, OnChanges, SimpleChange } from '@angular/core';

import { localize } from 'vs/nls';
import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { ISanitizer, defaultSanitizer } from 'sql/parts/notebook/outputs/sanitizer';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { CellToggleMoreActions } from 'sql/parts/notebook/cellToggleMoreActions';

export const TEXT_SELECTOR: string = 'text-cell-component';

@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('preview', { read: ElementRef }) private output: ElementRef;
	@ViewChild('moreactions', { read: ElementRef }) private moreActionsElementRef: ElementRef;
	@Input() cellModel: ICellModel;

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@Input() set hover(value: boolean) {
		this._hover = value;
		if (!this.isActive()) {
			// Only make a change if we're not active, since this has priority
			this.updateMoreActions();
		}
	}

	private _content: string;
	private isEditMode: boolean;
	private _sanitizer: ISanitizer;
	private _model: NotebookModel;
	private _activeCellId: string;
	private readonly _onDidClickLink = this._register(new Emitter<URI>());
	public readonly onDidClickLink = this._onDidClickLink.event;
	protected isLoading: boolean;
	private _cellToggleMoreActions: CellToggleMoreActions;
	private _hover: boolean;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IOpenerService) private readonly openerService: IOpenerService,
	) {
		super();
		this.isEditMode = true;
		this.isLoading = true;
		this._cellToggleMoreActions = this._instantiationService.createInstance(CellToggleMoreActions);
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private setLoading(isLoading: boolean): void {
		this.isLoading = isLoading;
		this._changeRef.detectChanges();
	}

	ngOnInit() {
		this.setLoading(false);
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this._cellToggleMoreActions.onInit(this.moreActionsElementRef, this.model, this.cellModel);
		this.setFocusAndScroll();
		this._register(this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		}));
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				// If the activeCellId is undefined (i.e. in an active cell update), don't unnecessarily set editMode to false;
				// it will be set to true in a subsequent call to toggleEditMode()
				if (changedProp.previousValue !== undefined) {
					this.toggleEditMode(false);
				}
				break;
			}
		}
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview() {
		if (this._content !== this.cellModel.source || this.cellModel.source.length === 0) {
			if (!this.cellModel.source && !this.isEditMode) {
				this._content = localize('doubleClickEdit', 'Double-click to edit');
			} else {
				this._content = this.sanitizeContent(this.cellModel.source);
			}
			// todo: pass in the notebook filename instead of undefined value
			this._commandService.executeCommand<string>('notebook.showPreview', undefined, this._content).then((htmlcontent) => {
				let outputElement = <HTMLElement>this.output.nativeElement;
				outputElement.innerHTML = htmlcontent;
			});
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.cellModel && !this.cellModel.trustedMode) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}


	// Todo: implement layout
	public layout() {
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.output.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();

		let moreActionsEl = <HTMLElement>this.moreActionsElementRef.nativeElement;
		moreActionsEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}

	public toggleEditMode(editMode?: boolean): void {
		this.isEditMode = editMode !== undefined? editMode : !this.isEditMode;
		this.updateMoreActions();
		this.updatePreview();
		this._changeRef.detectChanges();
	}

	private updateMoreActions(): void {
		if (!this.isEditMode && (this.isActive() || this._hover)) {
			this.toggleMoreActionsButton(true);
		}
		else {
			this.toggleMoreActionsButton(false);
		}
	}

	private setFocusAndScroll(): void {
		this.toggleEditMode(this.isActive());

		if (this.output && this.output.nativeElement) {
			(<HTMLElement>this.output.nativeElement).scrollTo();
		}
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	protected toggleMoreActionsButton(isActiveOrHovered: boolean) {
		this._cellToggleMoreActions.toggleVisible(!isActiveOrHovered);
	}
}
