/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import 'vs/css!./textCell';
// import 'vs/css!./media/markdown';
// import 'vs/css!./media/highlight';

// import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, OnChanges, SimpleChange, HostListener, AfterContentInit } from '@angular/core';
// import * as path from 'path';

// import { localize } from 'vs/nls';
// import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
// import * as themeColors from 'vs/workbench/common/theme';
// import { ICommandService } from 'vs/platform/commands/common/commands';
// import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
// import { Emitter } from 'vs/base/common/event';
// import { URI } from 'vs/base/common/uri';
// import { IOpenerService } from 'vs/platform/opener/common/opener';
// import * as DOM from 'vs/base/browser/dom';
// import { onUnexpectedError } from 'vs/base/common/errors';
// import { IMouseEvent } from 'vs/base/browser/mouseEvent';
// import product from 'vs/platform/product/node/product';

// import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
// import { ISanitizer, defaultSanitizer } from 'sql/workbench/parts/notebook/outputs/sanitizer';
// import { AngularDisposable } from 'sql/base/node/lifecycle';
// import { IMimeComponent } from 'sql/workbench/parts/notebook/outputs/mimeRegistry';
// import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
// import { MimeModel } from 'sql/workbench/parts/notebook/outputs/common/mimemodel';

// export const MD_SELECTOR: string = 'markdown-output';
// const knownSchemes = new Set(['http', 'https', 'file', 'mailto', 'data', `${product.urlProtocol}`, 'azuredatastudio', 'azuredatastudio-insiders', 'vscode', 'vscode-insiders', 'vscode-resource']);

// @Component({
// 	selector: MD_SELECTOR,
// 	template: `
// 	<div style="overflow: hidden; width: 100%; height: 100%; display: flex; flex-flow: row">
// 		<div class="icon in-progress" *ngIf="loading === true"></div>
// 		<div #output class="notebook-preview" style="flex: 1 1 auto"">
// 		</div>
// 	</div>
// 	`
// })
// export class MarkdownOutputComponent extends AngularDisposable implements IMimeComponent, OnInit, AfterContentInit, OnChanges {
// 	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

// 	private _sanitizer: ISanitizer;
// 	private readonly _onDidClickLink = this._register(new Emitter<URI>());
// 	public readonly onDidClickLink = this._onDidClickLink.event;
// 	private _bundleOptions: MimeModel.IOptions;
// 	private _initialized: boolean = false;
// 	public loading: boolean = false;
// 	constructor(
// 		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
// 		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
// 		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
// 		@Inject(ICommandService) private _commandService: ICommandService,
// 		@Inject(IOpenerService) private readonly openerService: IOpenerService,
// 		@Inject(INotebookService) private _notebookService: INotebookService

// 	) {
// 		super();
// 		this._sanitizer = this._notebookService.getMimeRegistry().sanitizer;

// 	}

// 	@Input() set bundleOptions(value: MimeModel.IOptions) {
// 		this._bundleOptions =  value;
// 		if (this._initialized) {
// 			this.updatePreview();
// 		}
// 	}

// 	@Input() mimeType: string;

// 	//Gets sanitizer from ISanitizer interface
// 	private get sanitizer(): ISanitizer {
// 		if (this._sanitizer) {
// 			return this._sanitizer;
// 		}
// 		return this._sanitizer = defaultSanitizer;
// 	}

// 	private setLoading(isLoading: boolean): void {
// 		this.loading = isLoading;
// 		this._changeRef.detectChanges();
// 	}

// 	ngOnInit() {
// 		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
// 		this.updateTheme(this.themeService.getColorTheme());
// 	}

// 	ngAfterContentInit(): void {
// 		if (this.output) {
// 			let element: HTMLElement = this.output.nativeElement;
// 			this._register(DOM.addStandardDisposableListener(element, 'click', event => {
// 				// Note: this logic is taken from the VSCode handling of links in markdown
// 				// Untrusted cells will not support commands or raw HTML tags
// 				// Finally, we should consider supporting relative paths - created #5238 to track
// 				let target: HTMLElement | null = event.target;
// 				if (target.tagName !== 'A') {
// 					target = target.parentElement;
// 					if (!target || target.tagName !== 'A') {
// 						return;
// 					}
// 				}
// 				try {
// 					const href = target['href'];
// 					if (href) {
// 						this.handleLink(href, event);
// 					}
// 				} catch (err) {
// 					onUnexpectedError(err);
// 				} finally {
// 					event.preventDefault();
// 				}
// 			}));
// 		}
// 	}

// 	private handleLink(content: string, event?: IMouseEvent): void {
// 		let uri: URI | undefined;
// 		try {
// 			uri = URI.parse(content);
// 		} catch {
// 			// ignore
// 		}
// 		if (uri && this.openerService && this.isSupportedLink(uri)) {
// 			this.openerService.open(uri).catch(onUnexpectedError);
// 		}
// 	}

// 	private isSupportedLink(link: URI): boolean {
// 		if (knownSchemes.has(link.scheme)) {
// 			return true;
// 		}
// 		return !!this.model.trustedMode && link.scheme === 'command';
// 	}


// 	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
// 		for (let propName in changes) {
// 			if (propName === 'activeCellId') {
// 				let changedProp = changes[propName];
// 				this._activeCellId = changedProp.currentValue;
// 				this.toggleUserSelect(this.isActive());
// 				// If the activeCellId is undefined (i.e. in an active cell update), don't unnecessarily set editMode to false;
// 				// it will be set to true in a subsequent call to toggleEditMode()
// 				if (changedProp.previousValue !== undefined) {
// 					this.toggleEditMode(false);
// 				}
// 				break;
// 			}
// 		}
// 	}

// 	/**
// 	 * Updates the preview of markdown component with latest changes
// 	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
// 	 * Sanitizes the data to be shown in markdown cell
// 	 */
// 	private updatePreview() {
// 		let trustedChanged = this.cellModel && this._lastTrustedMode !== this.cellModel.trustedMode;
// 		let contentChanged = this._content !== this.cellModel.source || this.cellModel.source.length === 0;
// 		if (trustedChanged || contentChanged) {
// 			this._lastTrustedMode = this.cellModel.trustedMode;
// 			if (!this.cellModel.source && !this.isEditMode) {
// 				this._content = localize('doubleClickEdit', 'Double-click to edit');
// 			} else {
// 				this._content = this.cellModel.source;
// 			}

// 			this._commandService.executeCommand<string>('notebook.showPreview', this.cellModel.notebookModel.notebookUri, this._content).then((htmlcontent) => {
// 				htmlcontent = this.convertVscodeResourceToFileInSubDirectories(htmlcontent);
// 				htmlcontent = this.sanitizeContent(htmlcontent);
// 				let outputElement = <HTMLElement>this.output.nativeElement;
// 				outputElement.innerHTML = htmlcontent;
// 				this.setLoading(false);
// 			});
// 		}
// 	}

// 	//Sanitizes the content based on trusted mode of Cell Model
// 	private sanitizeContent(content: string): string {
// 		if (this.cellModel && !this.cellModel.trustedMode) {
// 			content = this.sanitizer.sanitize(content);
// 		}
// 		return content;
// 	}
// 	// Only replace vscode-resource with file when in the same (or a sub) directory
// 	// This matches Jupyter Notebook viewer behavior
// 	private convertVscodeResourceToFileInSubDirectories(htmlContent: string): string {
// 		let htmlContentCopy = htmlContent;
// 		while (htmlContentCopy.search('(?<=img src=\"vscode-resource:)') > 0) {
// 			let pathStartIndex = htmlContentCopy.search('(?<=img src=\"vscode-resource:)');
// 			let pathEndIndex = htmlContentCopy.indexOf('\" ', pathStartIndex);
// 			let filePath = htmlContentCopy.substring(pathStartIndex, pathEndIndex);
// 			// If the asset is in the same folder or a subfolder, replace 'vscode-resource:' with 'file:', so the image is visible
// 			if (!path.relative(path.dirname(this.cellModel.notebookModel.notebookUri.fsPath), filePath).includes('..')) {
// 				// ok to change from vscode-resource: to file:
// 				htmlContent = htmlContent.replace('vscode-resource:' + filePath, 'file:' + filePath);
// 			}
// 			htmlContentCopy = htmlContentCopy.slice(pathEndIndex);
// 		}
// 		return htmlContent;
// 	}


// 	// Todo: implement layout
// 	public layout() {
// 	}

// 	private updateTheme(theme: IColorTheme): void {
// 		// let outputElement = <HTMLElement>this.output.nativeElement;
// 		// outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
// 	}

// 	public handleContentChanged(): void {
// 		this.updatePreview();
// 	}
// }
