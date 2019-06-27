/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../cellViews/textCell';
import 'vs/css!../cellViews/media/markdown';
import 'vs/css!../cellViews/media/highlight';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild } from '@angular/core';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ISanitizer, defaultSanitizer } from 'sql/workbench/parts/notebook/electron-browser/outputs/sanitizer';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IMimeComponent } from 'sql/workbench/parts/notebook/electron-browser/outputs/mimeRegistry';
import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { MimeModel } from 'sql/workbench/parts/notebook/common/models/mimemodel';
import { ICellModel } from 'sql/workbench/parts/notebook/node/models/modelInterfaces';
import { convertVscodeResourceToFileInSubDirectories } from 'sql/workbench/parts/notebook/node/models/notebookUtils';

@Component({
	selector: MarkdownOutputComponent.SELECTOR,
	templateUrl: decodeURI(require.toUrl('./markdownOutput.component.html'))
})
export class MarkdownOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'markdown-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _sanitizer: ISanitizer;
	private _lastTrustedMode: boolean;

	private _bundleOptions: MimeModel.IOptions;
	private _initialized: boolean = false;
	public loading: boolean = false;
	private _cellModel: ICellModel;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(INotebookService) private _notebookService: INotebookService

	) {
		super();
		this._sanitizer = this._notebookService.getMimeRegistry().sanitizer;
	}

	@Input() set bundleOptions(value: MimeModel.IOptions) {
		this._bundleOptions = value;
		if (this._initialized) {
			this.updatePreview();
		}
	}

	@Input() mimeType: string;

	get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() set cellModel(value: ICellModel) {
		this._cellModel = value;
	}

	public get isTrusted(): boolean {
		return this._bundleOptions && this._bundleOptions.trusted;
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	private setLoading(isLoading: boolean): void {
		this.loading = isLoading;
		this._changeRef.detectChanges();
	}

	ngOnInit() {
		this.updatePreview();
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview() {
		if (!this._bundleOptions || !this._cellModel) {
			return;
		}
		let trustedChanged = this._bundleOptions && this._lastTrustedMode !== this.isTrusted;
		if (trustedChanged || !this._initialized) {
			this._lastTrustedMode = this.isTrusted;
			let content = this._bundleOptions.data['text/markdown'];
			if (!content) {

			} else {
				this._commandService.executeCommand<string>('notebook.showPreview', this._cellModel.notebookModel.notebookUri, content).then((htmlcontent) => {
					htmlcontent = convertVscodeResourceToFileInSubDirectories(htmlcontent, this._cellModel);
					htmlcontent = this.sanitizeContent(htmlcontent);
					let outputElement = <HTMLElement>this.output.nativeElement;
					outputElement.innerHTML = htmlcontent;
					this.setLoading(false);
				});
			}
			this._initialized = true;
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.isTrusted) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}


	public layout() {
		// Do we need to update on layout changed?
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}
}
