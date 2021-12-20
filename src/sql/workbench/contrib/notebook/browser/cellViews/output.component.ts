/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import 'vs/css!./media/output';

import { OnInit, Component, Input, Inject, ElementRef, ViewChild, SimpleChange, AfterViewInit, forwardRef, ChangeDetectorRef, ComponentRef, ComponentFactoryResolver } from '@angular/core';
import * as Mark from 'mark.js';
import { Event } from 'vs/base/common/event';
import { nb } from 'azdata';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import * as outputProcessor from 'sql/workbench/contrib/notebook/browser/models/outputProcessor';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { ComponentHostDirective } from 'sql/base/browser/componentHost.directive';
import { Extensions, IMimeComponent, IMimeComponentRegistry } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as themeColors from 'vs/workbench/common/theme';
import { Registry } from 'vs/platform/registry/common/platform';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';
import { getErrorMessage } from 'vs/base/common/errors';
import { CellView, findHighlightClass, findRangeSpecificClass } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { INotebookService, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';

export const OUTPUT_SELECTOR: string = 'output-component';
const USER_SELECT_CLASS = 'actionselect';
const GRID_CLASS = '[class="grid-canvas"]';
const componentRegistry = <IMimeComponentRegistry>Registry.as(Extensions.MimeComponentContribution);

@Component({
	selector: OUTPUT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./output.component.html'))
})
export class OutputComponent extends CellView implements OnInit, AfterViewInit {
	@ViewChild('output', { read: ElementRef }) override output: ElementRef;
	@ViewChild(ComponentHostDirective) componentHost: ComponentHostDirective;
	@Input() cellOutput: nb.ICellOutput;
	@Input() cellModel: ICellModel;

	private _trusted: boolean;
	private _initialized: boolean = false;
	private _activeCellId: string;
	private _componentInstance: IMimeComponent;
	public errorText: string;

	constructor(
		@Inject(IThemeService) private _themeService: IThemeService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeref: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _ref: ElementRef,
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver,
		@Inject(INotebookService) override notebookService: INotebookService
	) {
		super();
	}

	ngOnInit() {
		this._register(this._themeService.onDidColorThemeChange(event => this.updateTheme(event)));
		this.loadComponent();
		this._initialized = true;
		this._register(Event.debounce(this.cellModel.notebookModel.layoutChanged, (l, e) => e, 50, /*leading=*/false)
			(() => this.layout()));
	}

	ngAfterViewInit() {
		this.updateTheme(this._themeService.getColorTheme());
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
		if (!this.nativeOutputElement) {
			return;
		}
		if (userSelect) {
			this.nativeOutputElement.classList.add(USER_SELECT_CLASS);
		} else {
			this.nativeOutputElement.classList.remove(USER_SELECT_CLASS);
		}
	}

	private get nativeOutputElement() {
		return this.output ? this.output.nativeElement : undefined;
	}

	public layout(): void {
		if (this.componentInstance && this.componentInstance.layout) {
			this.componentInstance.layout();
		}
	}

	private get componentInstance(): IMimeComponent {
		if (!this._componentInstance) {
			this.loadComponent();
		}
		return this._componentInstance;
	}

	get trustedMode(): boolean {
		return this._trusted;
	}

	@Input() set trustedMode(value: boolean) {
		this._trusted = value;
		if (this._initialized) {
			this.layout();
		}
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	public hasError(): boolean {
		return !types.isUndefinedOrNull(this.errorText);
	}
	private updateTheme(theme: IColorTheme): void {
		let el = <HTMLElement>this._ref.nativeElement;
		let backgroundColor = theme.getColor(colors.editorBackground, true);
		let foregroundColor = theme.getColor(themeColors.SIDE_BAR_FOREGROUND, true);

		if (backgroundColor) {
			el.style.backgroundColor = backgroundColor.toString();
		}
		if (foregroundColor) {
			el.style.color = foregroundColor.toString();
		}
	}

	private loadComponent(): void {
		let options = outputProcessor.getBundleOptions({ value: this.cellOutput, trusted: this.trustedMode });
		options.themeService = this._themeService;
		let mimeType = componentRegistry.getPreferredMimeType(
			options.data,
			options.trusted ? 'any' : 'ensure'
		);
		this.errorText = undefined;
		if (!mimeType) {
			this.errorText = localize('noMimeTypeFound', "No {0}renderer could be found for output. It has the following MIME types: {1}",
				options.trusted ? '' : localize('safe', "safe "),
				Object.keys(options.data).join(', '));
			return;
		}
		let selector = componentRegistry.getCtorFromMimeType(mimeType);
		if (!selector) {
			this.errorText = localize('noSelectorFound', "No component could be found for selector {0}", mimeType);
			return;
		}

		let componentFactory = this._componentFactoryResolver.resolveComponentFactory(selector);

		let viewContainerRef = this.componentHost.viewContainerRef;
		viewContainerRef.clear();

		let componentRef: ComponentRef<IMimeComponent>;
		try {
			componentRef = viewContainerRef.createComponent(componentFactory, 0);
			this._componentInstance = componentRef.instance;
			this._componentInstance.mimeType = mimeType;
			this._componentInstance.cellModel = this.cellModel;
			this._componentInstance.cellOutput = this.cellOutput;
			this._componentInstance.bundleOptions = options;
			this._changeref.detectChanges();
			let el = <HTMLElement>componentRef.location.nativeElement;

			// set widget styles to conform to its box
			el.style.overflow = 'hidden';
			el.style.position = 'relative';
		} catch (e) {
			this.errorText = localize('componentRenderError', "Error rendering component: {0}", getErrorMessage(e));
			return;
		}
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}

	override isCellOutput = true;

	getCellModel(): ICellModel {
		return this.cellModel;
	}

	protected override addDecoration(range?: NotebookRange): void {
		range = range ?? this.highlightRange;
		if (this.output && this.output.nativeElement) {
			this.highlightAllMatches();
			if (range) {
				let elements = this.getHtmlElements();
				if (elements.length === 1 && elements[0].nodeName === 'MIME-OUTPUT') {
					let markCurrent = new Mark(elements[0]);
					markCurrent.markRanges([{
						start: range.startColumn - 1, //subtracting 1 since markdown html is 0 indexed.
						length: range.endColumn - range.startColumn
					}], {
						className: findRangeSpecificClass,
						each: function (node, range) {
							// node is the marked DOM element
							node.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}
					});
				} else if (elements?.length >= range.startLineNumber) {
					let elementContainingText = elements[range.startLineNumber - 1];
					let markCurrent = new Mark(elementContainingText); // to highlight the current item of them all.
					if (elementContainingText.children.length > 0) {
						markCurrent = new Mark(elementContainingText.children[range.startColumn]);
						markCurrent?.mark(this.searchTerm, {
							className: findRangeSpecificClass,
							each: function (node, range) {
								// node is the marked DOM element
								node.scrollIntoView({ behavior: 'smooth', block: 'center' });
							}
						});
					}
				}
			}
		}
	}

	protected override highlightAllMatches(): void {
		if (this.output && this.output.nativeElement) {
			let markAllOccurances = new Mark(this.output.nativeElement); // to highlight all occurances in the element.
			if (!this._model) {
				this._model = this.getCellModel().notebookModel;
			}
			let editor = this.notebookService.findNotebookEditor(this._model?.notebookUri);
			if (editor) {
				let findModel = (editor.notebookParams.input as NotebookInput).notebookFindModel;
				if (findModel?.findMatches?.length > 0) {
					this.searchTerm = findModel.findExpression;
					markAllOccurances.mark(this.searchTerm, {
						className: findHighlightClass,
						separateWordSearch: true,
					});
					// if there are grids
					let grids = document.querySelectorAll(GRID_CLASS);
					grids?.forEach(g => {
						markAllOccurances = new Mark(g);
						markAllOccurances.mark(this.searchTerm, {
							className: findHighlightClass
						});
					});
				}
			}
		}
	}

	protected override removeDecoration(range?: NotebookRange): void {
		if (this.output && this.output.nativeElement) {
			if (range) {
				let elements = this.getHtmlElements();
				let elementContainingText = elements[range.startLineNumber - 1];
				if (elements.length === 1 && elements[0].nodeName === 'MIME-OUTPUT') {
					elementContainingText = elements[0];
				}
				let markCurrent = new Mark(elementContainingText);
				markCurrent.unmark({ acrossElements: true, className: findRangeSpecificClass });
			} else {
				let markAllOccurances = new Mark(this.output.nativeElement);
				markAllOccurances.unmark({ acrossElements: true, className: findHighlightClass });
				markAllOccurances.unmark({ acrossElements: true, className: findRangeSpecificClass });
				this.highlightRange = undefined;
				// if there is a grid
				let grids = document.querySelectorAll(GRID_CLASS);
				grids?.forEach(g => {
					markAllOccurances = new Mark(g);
					markAllOccurances.unmark({ acrossElements: true, className: findHighlightClass });
					markAllOccurances.unmark({ acrossElements: true, className: findRangeSpecificClass });
				});
			}
		}
	}

	protected override getHtmlElements(): any[] {
		let children = [];
		let slickGrids = this.output.nativeElement.querySelectorAll(GRID_CLASS);
		if (slickGrids.length > 0) {
			slickGrids.forEach(grid => {
				children.push(...grid.children);
			});
		} else {
			// if the decoration range belongs to code cell output and output is a stream of data
			// it's in <mime-output> tag of the output.
			let outputMessages = this.output.nativeElement.querySelectorAll('mime-output');
			children.push(...outputMessages);
		}
		return children;
	}

}
