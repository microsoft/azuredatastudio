/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Input, Inject, ElementRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IMimeComponent } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { NotebookMarkdownRenderer } from 'sql/workbench/contrib/notebook/browser/outputs/notebookMarkdown';
import { MimeModel } from 'sql/workbench/services/notebook/browser/outputs/mimemodel';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { URI } from 'vs/base/common/uri';

@Component({
	selector: MarkdownOutputComponent.SELECTOR,
	templateUrl: decodeURI(require.toUrl('./markdownOutput.component.html'))
})
export class MarkdownOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'markdown-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _lastTrustedMode: boolean;

	private _bundleOptions: MimeModel.IOptions;
	private _initialized: boolean = false;
	public loading: boolean = false;
	private _cellModel: ICellModel;
	private _markdownRenderer: NotebookMarkdownRenderer;

	constructor(
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService

	) {
		super();
		this._markdownRenderer = this._instantiationService.createInstance(NotebookMarkdownRenderer);
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
		if (this._initialized) {
			this.updatePreview();
		}
	}

	public get isTrusted(): boolean {
		return this._bundleOptions && this._bundleOptions.trusted;
	}

	public get notebookUri(): URI {
		return this.cellModel.notebookModel.notebookUri;
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
			this._markdownRenderer.setNotebookURI(this.cellModel.notebookModel.notebookUri);
			let markdownResult = this._markdownRenderer.render({
				isTrusted: this.cellModel.trustedMode,
				value: content.toString()
			});
			let outputElement = <HTMLElement>this.output.nativeElement;
			outputElement.innerHTML = markdownResult.element.innerHTML;
			this._initialized = true;
		}
	}

	public layout() {
		// Do we need to update on layout changed?
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}
}
