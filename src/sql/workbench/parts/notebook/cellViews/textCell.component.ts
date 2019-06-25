/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';
import 'vs/css!./media/markdown';
import 'vs/css!./media/highlight';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnChanges, SimpleChange, HostListener, AfterContentInit } from '@angular/core';
import * as path from 'path';

import { localize } from 'vs/nls';
import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as DOM from 'vs/base/browser/dom';

import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { CellView } from 'sql/workbench/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { ISanitizer, defaultSanitizer } from 'sql/workbench/parts/notebook/outputs/sanitizer';
import { NotebookModel } from 'sql/workbench/parts/notebook/models/notebookModel';
import { CellToggleMoreActions } from 'sql/workbench/parts/notebook/cellToggleMoreActions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { toDisposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { RenderOptions } from 'vs/base/browser/htmlContentRenderer';
import { IMarkdownString, removeMarkdownEscapes } from 'vs/base/common/htmlContent';
import { IMarkdownRenderResult } from 'vs/editor/contrib/markdown/markdownRenderer';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { onUnexpectedError } from 'vs/base/common/errors';
import marked = require('vs/base/common/marked/marked');
import { defaultGenerator } from 'vs/base/common/idGenerator';
import { revive } from 'vs/base/common/marshalling';
import * as fs from 'fs';

export const TEXT_SELECTOR: string = 'text-cell-component';
const USER_SELECT_CLASS = 'actionselect';


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
	private _cellToggleMoreActions: CellToggleMoreActions;
	private _hover: boolean;
	private markdownRenderer: MarkdownRenderer;
	private markdownResult: IMarkdownRenderResult;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IOpenerService) private readonly openerService: IOpenerService,
		@Inject(IConfigurationService) private configurationService: IConfigurationService,

	) {
		super();
		this.isEditMode = true;
		this._cellToggleMoreActions = this._instantiationService.createInstance(CellToggleMoreActions);
		this.markdownRenderer = this._instantiationService.createInstance(MarkdownRenderer);
		this._register(toDisposable(() => {
			if (this.markdownResult) {
				this.markdownResult.dispose();
			}
		}));

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
		this.cellModel.loaded = !isLoading;
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

	public get isTrusted(): boolean {
		return this.model.trustedMode;
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview(): void {
		let trustedChanged = this.cellModel && this._lastTrustedMode !== this.cellModel.trustedMode;
		let contentChanged = this._content !== this.cellModel.source || this.cellModel.source.length === 0;
		if (trustedChanged || contentChanged) {
			this._lastTrustedMode = this.cellModel.trustedMode;
			if (!this.cellModel.source && !this.isEditMode) {
				this._content = localize('doubleClickEdit', 'Double-click to edit');
			} else {
				this._content = this.cellModel.source;
			}

			if (this.useSimpleMarkdown) {
				let time0 = performance.now();
				let uri = Object.create(null);
				this.markdownRenderer.setNotebookURI(this.cellModel.notebookModel.notebookUri);
				this.markdownResult = this.markdownRenderer.render({
					isTrusted: this.cellModel.trustedMode,
					value: this._content,
					uris: uri
				});
				let outputElement = <HTMLElement>this.output.nativeElement;
				DOM.clearNode(outputElement);
				DOM.append(outputElement, this.markdownResult.element);
				let elapsed = performance.now() - time0;
				console.log(`time to render simply is ${elapsed}ms`);
			} else {
				let time0 = performance.now();
				this._commandService.executeCommand<string>('notebook.showPreview', this.cellModel.notebookModel.notebookUri, this._content).then((htmlcontent) => {
					htmlcontent = this.convertVscodeResourceToFileInSubDirectories(htmlcontent);
					htmlcontent = this.sanitizeContent(htmlcontent);
					let outputElement = <HTMLElement>this.output.nativeElement;
					outputElement.innerHTML = htmlcontent;
					this.setLoading(false);
					let elapsed = performance.now() - time0;
					console.log(`time to render over extension host is ${elapsed}ms`);
				});
			}
		}
	}

	private get useSimpleMarkdown(): boolean {
		return this.configurationService.getValue('notebook.useSimpleMarkdown');
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

class MarkdownRenderer {
	private _notebookURI: URI;
	private _baseUrls: string[] = [];

	constructor(
		@IOpenerService private readonly _openerService: IOpenerService
	) {
	}

	private getOptions(disposables: IDisposable[]): RenderOptions {
		return {
			actionHandler: {
				callback: (content) => {
					let uri: URI | undefined;
					try {
						uri = URI.parse(content);
					} catch {
						// ignore
					}
					if (uri && this._openerService) {
						this._openerService.open(uri).catch(onUnexpectedError);
					}
				},
				disposeables: disposables
			}
		};
	}

	render(markdown: IMarkdownString): IMarkdownRenderResult {
		let disposables: IDisposable[] = [];
		const element: HTMLElement = markdown ? this.renderMarkdown(markdown, this.getOptions(disposables)) : document.createElement('span');
		return {
			element,
			dispose: () => dispose(disposables)
		};
	}

	createElement(options: RenderOptions): HTMLElement {
		const tagName = options.inline ? 'span' : 'div';
		const element = document.createElement(tagName);
		if (options.className) {
			element.className = options.className;
		}
		return element;
	}

	parse(text: string): any {
		let data = JSON.parse(text);
		data = revive(data, 0);
		return data;
	}

	/**
	 * Create html nodes for the given content element.
	 * Adapted from {@link htmlContentRenderer}
	 */
	renderMarkdown(markdown: IMarkdownString, options: RenderOptions = {}): HTMLElement {
		const element = this.createElement(options);

		// signal to code-block render that the
		// element has been created
		let signalInnerHTML: () => void;
		const withInnerHTML = new Promise(c => signalInnerHTML = c);

		let notebookFolder = path.dirname(this._notebookURI.fsPath) + '/';
		if (!this._baseUrls.includes(notebookFolder)) {
			this._baseUrls.push(notebookFolder);
		}
		const renderer = new marked.Renderer({ baseUrl: notebookFolder });
		renderer.image = (href: string, title: string, text: string) => {
			href = this.cleanUrl(!markdown.isTrusted, notebookFolder, href);
			let dimensions: string[] = [];
			if (href) {
				const splitted = href.split('|').map(s => s.trim());
				href = splitted[0];
				const parameters = splitted[1];
				if (parameters) {
					const heightFromParams = /height=(\d+)/.exec(parameters);
					const widthFromParams = /width=(\d+)/.exec(parameters);
					const height = heightFromParams ? heightFromParams[1] : '';
					const width = widthFromParams ? widthFromParams[1] : '';
					const widthIsFinite = isFinite(parseInt(width));
					const heightIsFinite = isFinite(parseInt(height));
					if (widthIsFinite) {
						dimensions.push(`width="${width}"`);
					}
					if (heightIsFinite) {
						dimensions.push(`height="${height}"`);
					}
				}
			}
			let attributes: string[] = [];
			if (href) {
				attributes.push(`src="${href}"`);
			}
			if (text) {
				attributes.push(`alt="${text}"`);
			}
			if (title) {
				attributes.push(`title="${title}"`);
			}
			if (dimensions.length) {
				attributes = attributes.concat(dimensions);
			}
			return '<img ' + attributes.join(' ') + '>';
		};
		renderer.link = (href, title, text): string => {
			href = this.cleanUrl(!markdown.isTrusted, notebookFolder, href);
			if (href === null) {
				return text;
			}
			// Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
			if (href === text) { // raw link case
				text = removeMarkdownEscapes(text);
			}
			title = removeMarkdownEscapes(title);
			href = removeMarkdownEscapes(href);
			if (
				!href
				|| !markdown.isTrusted
				|| href.match(/^data:|javascript:/i)
				|| href.match(/^command:(\/\/\/)?_workbench\.downloadResource/i)
			) {
				// drop the link
				return text;

			} else {
				// HTML Encode href
				href = href.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;');
				return `<a href=${href} data-href="${href}" title="${title || href}">${text}</a>`;
			}
		};
		renderer.paragraph = (text): string => {
			return `<p>${text}</p>`;
		};

		if (options.codeBlockRenderer) {
			renderer.code = (code, lang) => {
				const value = options.codeBlockRenderer!(lang, code);
				// when code-block rendering is async we return sync
				// but update the node with the real result later.
				const id = defaultGenerator.nextId();

				const promise = value.then(strValue => {
					withInnerHTML.then(e => {
						const span = element.querySelector(`div[data-code="${id}"]`);
						if (span) {
							span.innerHTML = strValue;
						}
					}).catch(err => {
						// ignore
					});
				});

				if (options.codeBlockRenderCallback) {
					promise.then(options.codeBlockRenderCallback);
				}

				return `<div class="code" data-code="${id}">${escape(code)}</div>`;
			};
		}

		if (options.actionHandler) {
			options.actionHandler.disposeables.push(DOM.addStandardDisposableListener(element, 'click', event => {
				let target: HTMLElement | null = event.target;
				if (target.tagName !== 'A') {
					target = target.parentElement;
					if (!target || target.tagName !== 'A') {
						return;
					}
				}
				try {
					const href = target.dataset['href'];
					if (href) {
						options.actionHandler!.callback(href, event);
					}
				} catch (err) {
					onUnexpectedError(err);
				} finally {
					event.preventDefault();
				}
			}));
		}

		const markedOptions: marked.MarkedOptions = {
			sanitize: !markdown.isTrusted,
			renderer,
			baseUrl: notebookFolder
		};

		element.innerHTML = marked.parse(markdown.value, markedOptions);
		signalInnerHTML!();

		return element;
	}

	// This following methods have been adapted from marked.js
	// Copyright (c) 2011-2014, Christopher Jeffrey (https://github.com/chjj/)
	cleanUrl(sanitize, base, href) {
		if (sanitize) {
			let prot;
			try {
				prot = decodeURIComponent(unescape(href))
					.replace(/[^\w:]/g, '')
					.toLowerCase();
			} catch (e) {
				return null;
			}
			if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
				return null;
			}
		}
		try {
			if (URI.parse(href)) {
				return href;
			}
		} catch {
			// ignore
		}
		let originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;
		if (base && !originIndependentUrl.test(href) && !fs.existsSync(href)) {
			href = this.resolveUrl(base, href);
		}
		try {
			href = encodeURI(href).replace(/%25/g, '%');
		} catch (e) {
			return null;
		}
		return href;
	}

	resolveUrl(base: string, href: string) {
		if (!this._baseUrls[' ' + base]) {
			// we can ignore everything in base after the last slash of its path component,
			// but we might need to add _that_
			// https://tools.ietf.org/html/rfc3986#section-3
			if (/^[^:]+:\/*[^/]*$/.test(base)) {
				this._baseUrls[' ' + base] = base + '/';
			} else {
				// Remove trailing 'c's. /c*$/ is vulnerable to REDOS.
				this._baseUrls[' ' + base] = base.replace(/c*$/, '');
			}
		}
		base = this._baseUrls[' ' + base];

		if (href.slice(0, 2) === '//') {
			return base.replace(/:[\s\S]*/, ':') + href;
		} else if (href.charAt(0) === '/') {
			return base.replace(/(:\/*[^/]*)[\s\S]*/, '$1') + href;
		} else {
			return base + href;
		}
	}

	// end marked.js adaptation

	setNotebookURI(val: URI) {
		this._notebookURI = val;
	}


}
