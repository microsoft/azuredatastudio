/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import 'vs/css!./media/output';

import { OnInit, Component, Input, Inject, ElementRef, ViewChild, SimpleChange, AfterViewInit, forwardRef, ChangeDetectorRef, ComponentRef, ComponentFactoryResolver } from '@angular/core';
import { Event } from 'vs/base/common/event';
import { nb } from 'azdata';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import * as outputProcessor from 'sql/workbench/contrib/notebook/browser/models/outputProcessor';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import { ComponentHostDirective } from 'sql/base/browser/componentHost.directive';
import { Extensions, IMimeComponent, IMimeComponentRegistry } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as themeColors from 'vs/workbench/common/theme';
import { Registry } from 'vs/platform/registry/common/platform';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';
import { getErrorMessage } from 'vs/base/common/errors';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';

export const OUTPUT_SELECTOR: string = 'output-component';
const USER_SELECT_CLASS = 'actionselect';

const componentRegistry = <IMimeComponentRegistry>Registry.as(Extensions.MimeComponentContribution);

@Component({
	selector: OUTPUT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./output.component.html'))
})
export class OutputComponent extends CellView implements OnInit, AfterViewInit {
	@ViewChild('output', { read: ElementRef }) private outputElement: ElementRef;
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
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver
	) {
		super();
	}

	ngOnInit() {
		this._register(this._themeService.onDidColorThemeChange(event => this.updateTheme(event)));
		this.loadComponent();
		this.layout();
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
			DOM.addClass(this.nativeOutputElement, USER_SELECT_CLASS);
		} else {
			DOM.removeClass(this.nativeOutputElement, USER_SELECT_CLASS);
		}
	}

	private get nativeOutputElement() {
		return this.outputElement ? this.outputElement.nativeElement : undefined;
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
}
