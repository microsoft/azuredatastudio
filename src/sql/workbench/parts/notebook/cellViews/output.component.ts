/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import 'vs/css!./media/output';

import { OnInit, Component, Input, Inject, ElementRef, ViewChild, SimpleChange } from '@angular/core';
import { AngularDisposable } from 'sql/base/node/lifecycle';
import { Event } from 'vs/base/common/event';
import { nb } from 'azdata';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { MimeModel } from 'sql/workbench/parts/notebook/outputs/common/mimemodel';
import * as outputProcessor from 'sql/workbench/parts/notebook/outputs/common/outputProcessor';
import { RenderMimeRegistry } from 'sql/workbench/parts/notebook/outputs/registry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';

export const OUTPUT_SELECTOR: string = 'output-component';
const USER_SELECT_CLASS = 'actionselect';

@Component({
	selector: OUTPUT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./output.component.html'))
})
export class OutputComponent extends AngularDisposable implements OnInit {
	@ViewChild('output', { read: ElementRef }) private outputElement: ElementRef;
	@Input() cellOutput: nb.ICellOutput;
	@Input() cellModel: ICellModel;
	private _trusted: boolean;
	private _initialized: boolean = false;
	private _activeCellId: string;
	registry: RenderMimeRegistry;


	constructor(
		@Inject(INotebookService) private _notebookService: INotebookService,
		@Inject(IThemeService) private _themeService: IThemeService
	) {
		super();
		this.registry = _notebookService.getMimeRegistry();
	}

	ngOnInit() {
		this.renderOutput();
		this._initialized = true;
		this._register(Event.debounce(this.cellModel.notebookModel.layoutChanged, (l, e) => e, 50, /*leading=*/false)
			(() => this.renderOutput()));
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {

		for (let propName in changes) {
			if (propName === 'activeCellId') {
				this.toggleUserSelect(this.isActive());
				break;
			}
		}
	}

	private toggleUserSelect(userSelect: boolean): void {
		if (!this.outputElement) {
			return;
		}
		if (userSelect) {
			DOM.addClass(this.outputElement.nativeElement, USER_SELECT_CLASS);
		} else {
			DOM.removeClass(this.outputElement.nativeElement, USER_SELECT_CLASS);
		}
	}

	private renderOutput(): void {
		let options = outputProcessor.getBundleOptions({ value: this.cellOutput, trusted: this.trustedMode });
		options.themeService = this._themeService;
		// TODO handle safe/unsafe mapping
		this.createRenderedMimetype(options, this.outputElement.nativeElement);
	}

	public layout(): void {
	}

	get trustedMode(): boolean {
		return this._trusted;
	}

	@Input() set trustedMode(value: boolean) {
		this._trusted = value;
		if (this._initialized) {
			this.renderOutput();
		}
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	protected createRenderedMimetype(options: MimeModel.IOptions, node: HTMLElement): void {
		let mimeType = this.registry.preferredMimeType(
			options.data,
			options.trusted ? 'any' : 'ensure'
		);
		if (mimeType) {
			let output = this.registry.createRenderer(mimeType);
			output.node = node;
			let model = new MimeModel(options);
			output.renderModel(model).catch(error => {
				// Manually append error message to output
				output.node.innerHTML = `<pre>Javascript Error: ${error.message}</pre>`;
				// Remove mime-type-specific CSS classes
				output.node.className = 'p-Widget jp-RenderedText';
				output.node.setAttribute(
					'data-mime-type',
					'application/vnd.jupyter.stderr'
				);
			});
			//this.setState({ node: node });
		} else {
			// TODO Localize
			node.innerHTML =
				`No ${options.trusted ? '' : '(safe) '}renderer could be ` +
				'found for output. It has the following MIME types: ' +
				Object.keys(options.data).join(', ');
			//this.setState({ node: node });
		}
	}
	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}
}
