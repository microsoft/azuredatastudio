/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/media/icons/common-icons';

import {
	Component, Input, Inject, forwardRef, ComponentFactoryResolver, ViewChild,
	ElementRef, OnInit, ChangeDetectorRef, ReflectiveInjector, Injector, ComponentRef
} from '@angular/core';

import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { error } from 'sql/base/common/log';
import { AngularDisposable } from 'sql/base/node/lifecycle';
import { IComponent, IComponentConfig, IComponentDescriptor, IModelStore, COMPONENT_CONFIG } from './interfaces';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as themeColors from 'vs/workbench/common/theme';
import { Registry } from 'vs/platform/registry/common/platform';
import { memoize } from 'vs/base/common/decorators';
import { generateUuid } from 'vs/base/common/uuid';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { Event } from 'vs/base/common/event';
import { LayoutRequestParams } from 'sql/platform/dialog/dialogContainer.component';

const componentRegistry = <IComponentRegistry>Registry.as(Extensions.ComponentContribution);

export interface ModelComponentParams extends IBootstrapParams {

	onLayoutRequested: Event<LayoutRequestParams>;
	modelViewId: string;
}

@Component({
	selector: 'model-component-wrapper',
	template: `
		<ng-template component-host>
		</ng-template>
	`
})
export class ModelComponentWrapper extends AngularDisposable implements OnInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@memoize
	public get guid(): string {
		return generateUuid();
	}

	private _componentInstance: IComponent;
	private _modelViewId: string;

	@ViewChild(ComponentHostDirective) componentHost: ComponentHostDirective;

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver,
		@Inject(forwardRef(() => ElementRef)) private _ref: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeref: ChangeDetectorRef,
		@Inject(forwardRef(() => Injector)) private _injector: Injector,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IBootstrapParams) private _params: ModelComponentParams
	) {
		super();
		if (_params && _params.onLayoutRequested) {
			this._modelViewId = _params.modelViewId;
			_params.onLayoutRequested(layoutParams => {
				if (layoutParams && (layoutParams.alwaysRefresh || layoutParams.modelViewId === this._modelViewId)) {
					this.layout();
				}
			});
		}
	}

	ngOnInit() {
		let self = this;
		this._register(self.themeService.onDidColorThemeChange((event: IColorTheme) => {
			self.updateTheme(event);
		}));
	}

	ngAfterViewInit() {
		this.updateTheme(this.themeService.getColorTheme());
		if (this.componentHost) {
			this.loadComponent();
		}
		this._changeref.detectChanges();
		this.layout();
	}

	public layout(): void {
		if (this.componentInstance && this.componentInstance.layout) {
			this.componentInstance.layout();
		}
	}

	public get id(): string {
		return this._componentInstance.descriptor.id;
	}

	private get componentConfig(): IComponentConfig {
		return {
			descriptor: this.descriptor,
			modelStore: this.modelStore
		};
	}

	private get componentInstance(): IComponent {
		if (!this._componentInstance) {
			this.loadComponent();
		}
		return this._componentInstance;
	}

	private loadComponent(): void {
		if (!this.descriptor || !this.descriptor.type) {
			error('No descriptor or type defined for this component');
			return;
		}

		let selector = componentRegistry.getCtorFromId(this.descriptor.type);

		if (selector === undefined) {
			error('No selector defined for type {0}', this.descriptor.type);
			return;
		}

		let componentFactory = this._componentFactoryResolver.resolveComponentFactory(selector);

		let viewContainerRef = this.componentHost.viewContainerRef;
		viewContainerRef.clear();

		let injector = ReflectiveInjector.resolveAndCreate([{ provide: COMPONENT_CONFIG, useValue: this.componentConfig }], this._injector);
		let componentRef: ComponentRef<IComponent>;
		try {
			componentRef = viewContainerRef.createComponent(componentFactory, 0, injector);
			this._componentInstance = componentRef.instance;
			this._componentInstance.descriptor = this.descriptor;
			this._componentInstance.modelStore = this.modelStore;
			this._changeref.detectChanges();
		} catch (e) {
			error('Error rendering component: {0}', e);
			return;
		}
		let el = <HTMLElement>componentRef.location.nativeElement;

		// set widget styles to conform to its box
		el.style.overflow = 'hidden';
		el.style.position = 'relative';
	}

	private updateTheme(theme: IColorTheme): void {
		// TODO handle theming appropriately
		let el = <HTMLElement>this._ref.nativeElement;
		let borderColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true);
		let backgroundColor = theme.getColor(colors.editorBackground, true);
		let foregroundColor = theme.getColor(themeColors.SIDE_BAR_FOREGROUND, true);
		let border = theme.getColor(colors.contrastBorder, true);

		if (backgroundColor) {
			el.style.backgroundColor = backgroundColor.toString();
		}

		if (foregroundColor) {
			el.style.color = foregroundColor.toString();
		}

	}
}