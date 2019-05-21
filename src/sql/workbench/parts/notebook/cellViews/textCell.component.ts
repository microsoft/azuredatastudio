/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';
import 'vs/css!./media/markdown';
import 'vs/css!./media/highlight';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, OnChanges, SimpleChange, HostListener, AfterContentInit } from '@angular/core';
import * as path from 'path';

import { localize } from 'vs/nls';
import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import * as DOM from 'vs/base/browser/dom';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import product from 'vs/platform/product/node/product';

import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { CellView } from 'sql/workbench/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { ISanitizer, defaultSanitizer } from 'sql/workbench/parts/notebook/outputs/sanitizer';
import { NotebookModel } from 'sql/workbench/parts/notebook/models/notebookModel';
import { CellToggleMoreActions } from 'sql/workbench/parts/notebook/cellToggleMoreActions';

export const TEXT_SELECTOR: string = 'text-cell-component';
const USER_SELECT_CLASS = 'actionselect';
const knownSchemes = new Set(['http', 'https', 'file', 'mailto', 'data', `${product.urlProtocol}`, 'azuredatastudio', 'azuredatastudio-insiders', 'vscode', 'vscode-insiders', 'vscode-resource']);

@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit, AfterContentInit, OnChanges {
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

	@HostListener('document:keydown.escape', ['$event'])
	handleKeyboardEvent() {
		if (this.isEditMode) {
			this.toggleEditMode(false);
		}
		this.cellModel.active = false;
		this._model.activeCell = undefined;
	}

	private _content: string;
	private _lastTrustedMode: boolean;
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
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this._cellToggleMoreActions.onInit(this.moreActionsElementRef, this.model, this.cellModel);
		this.setFocusAndScroll();
		this._register(this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		}));
		this.setLoading(false);
	}

	ngAfterContentInit(): void {
		if (this.output) {
			let element: HTMLElement = this.output.nativeElement;
			this._register(DOM.addStandardDisposableListener(element, 'click', event => {
				// Note: this logic is taken from the VSCode handling of links in markdown
				// Untrusted cells will not support commands or raw HTML tags
				// Finally, we should consider supporting relative paths - created #5238 to track
				let target: HTMLElement | null = event.target;
				if (target.tagName !== 'A') {
					target = target.parentElement;
					if (!target || target.tagName !== 'A') {
						return;
					}
				}
				try {
					const href = target['href'];
					if (href) {
						this.handleLink(href, event);
					}
				} catch (err) {
					onUnexpectedError(err);
				} finally {
					event.preventDefault();
				}
			}));
		}
	}

	private handleLink(content: string, event?: IMouseEvent): void {
		let uri: URI | undefined;
		try {
			uri = URI.parse(content);
		} catch {
			// ignore
		}
		if (uri && this.openerService && this.isSupportedLink(uri)) {
			this.openerService.open(uri).catch(onUnexpectedError);
		}
	}

	private isSupportedLink(link: URI): boolean {
		if (knownSchemes.has(link.scheme)) {
			return true;
		}
		return !!this.model.trustedMode && link.scheme === 'command';
	}


	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				this.toggleUserSelect(this.isActive());
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
		let trustedChanged = this.cellModel && this._lastTrustedMode !== this.cellModel.trustedMode;
		let contentChanged = this._content !== this.cellModel.source || this.cellModel.source.length === 0;
		if (trustedChanged || contentChanged) {
			this._lastTrustedMode = this.cellModel.trustedMode;
			if (!this.cellModel.source && !this.isEditMode) {
				this._content = localize('doubleClickEdit', 'Double-click to edit');
			} else {
				this._content = this.cellModel.source;
			}

			this._commandService.executeCommand<string>('notebook.showPreview', this.cellModel.notebookModel.notebookUri, this._content).then((htmlcontent) => {
				htmlcontent = this.convertVscodeResourceToFileInSubDirectories(htmlcontent);
				htmlcontent = this.sanitizeContent(htmlcontent);
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
	// Only replace vscode-resource with file when in the same (or a sub) directory
	// This matches Jupyter Notebook viewer behavior
	private convertVscodeResourceToFileInSubDirectories(htmlContent: string): string {
		let htmlContentCopy = htmlContent;
		while (htmlContentCopy.search('(?<=img src=\"vscode-resource:)') > 0) {
			let pathStartIndex = htmlContentCopy.search('(?<=img src=\"vscode-resource:)');
			let pathEndIndex = htmlContentCopy.indexOf('\" ', pathStartIndex);
			let filePath = htmlContentCopy.substring(pathStartIndex, pathEndIndex);
			// If the asset is in the same folder or a subfolder, replace 'vscode-resource:' with 'file:', so the image is visible
			if (!path.relative(path.dirname(this.cellModel.notebookModel.notebookUri.fsPath), filePath).includes('..')) {
				// ok to change from vscode-resource: to file:
				htmlContent = htmlContent.replace('vscode-resource:' + filePath, 'file:' + filePath);
			}
			htmlContentCopy = htmlContentCopy.slice(pathEndIndex);
		}
		return htmlContent;
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
		this.isEditMode = editMode !== undefined ? editMode : !this.isEditMode;
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

	private toggleUserSelect(userSelect: boolean): void {
		if (!this.output) {
			return;
		}
		if (userSelect) {
			DOM.addClass(this.output.nativeElement, USER_SELECT_CLASS);
		} else {
			DOM.removeClass(this.output.nativeElement, USER_SELECT_CLASS);
		}
	}

	private setFocusAndScroll(): void {
		this.toggleEditMode(this.isActive());

		if (this.output && this.output.nativeElement) {
			(<HTMLElement>this.output.nativeElement).scrollTo({ behavior: 'smooth' });
		}
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	protected toggleMoreActionsButton(isActiveOrHovered: boolean) {
		this._cellToggleMoreActions.toggleVisible(!isActiveOrHovered);
	}
}
