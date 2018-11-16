/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { ISanitizer, defaultSanitizer } from 'sql/parts/notebook/outputs/sanitizer';
import { localize } from 'vs/nls';

export const TEXT_SELECTOR: string = 'text-cell-component';

@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit {
	@ViewChild('preview', { read: ElementRef }) private output: ElementRef;
	@Input() cellModel: ICellModel;
	private _content: string;
	private isEditMode: boolean;
	private _sanitizer: ISanitizer;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ICommandService) private _commandService: ICommandService
	) {
		super();
		this.isEditMode = false;
	}

	ngOnChanges() {
		this.updatePreview();
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview() {
		if (this._content !== this.cellModel.source) {
			if (!this.cellModel.source && !this.isEditMode) {
				(<HTMLElement>this.output.nativeElement).innerHTML = localize('doubleClickEdit', 'Double-click to edit');
			} else {
				this._content = this.sanitizeContent(this.cellModel.source);
				// todo: pass in the notebook filename instead of undefined value
				this._commandService.executeCommand<string>('notebook.showPreview', undefined, this._content).then((htmlcontent) => {
					let outputElement = <HTMLElement>this.output.nativeElement;
					outputElement.innerHTML = htmlcontent;
				});
			}
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.cellModel && !this.cellModel.trustedMode) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}

	ngOnInit() {
		this.updatePreview();
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		});
	}

	// Todo: implement layout
	public layout() {
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.output.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}

	public toggleEditMode(): void {
		this.isEditMode = !this.isEditMode;
		this.updatePreview();
		this._changeRef.detectChanges();
	}
}
