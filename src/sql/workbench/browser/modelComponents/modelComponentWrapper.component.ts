/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, forwardRef, ComponentFactoryResolver, ViewChild,
	ChangeDetectorRef, Injector, ComponentRef, AfterViewInit
} from '@angular/core';

import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IComponentConfig, COMPONENT_CONFIG } from './interfaces';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/browser/modelComponentRegistry';

import { Registry } from 'vs/platform/registry/common/platform';
import { memoize } from 'vs/base/common/decorators';
import { generateUuid } from 'vs/base/common/uuid';
import { Event } from 'vs/base/common/event';
import { LayoutRequestParams } from 'sql/workbench/services/dialog/browser/dialogContainer.component';
import { ILogService } from 'vs/platform/log/common/log';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { IComponentDescriptor, IModelStore, IComponent } from 'sql/platform/dashboard/browser/interfaces';
import { ComponentHostDirective } from 'sql/base/browser/componentHost.directive';

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
export class ModelComponentWrapper extends AngularDisposable implements AfterViewInit {
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
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeref: ChangeDetectorRef,
		@Inject(forwardRef(() => Injector)) private _injector: Injector,
		@Inject(ILogService) private readonly logService: ILogService,
		@Inject(IBootstrapParams) params: ModelComponentParams
	) {
		super();
		if (params && params.onLayoutRequested) {
			this._modelViewId = params.modelViewId;
			this._register(params.onLayoutRequested(layoutParams => {
				if (layoutParams && (layoutParams.alwaysRefresh || layoutParams.modelViewId === this._modelViewId)) {
					this.layout();
				}
			}));
		}
	}

	ngAfterViewInit() {
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
			this.logService.error('No descriptor or type defined for this component');
			return;
		}

		let selector = componentRegistry.getCtorFromId(this.descriptor.type);

		if (selector === undefined) {
			this.logService.error('No selector defined for type {0}', this.descriptor.type);
			return;
		}

		let componentFactory = this._componentFactoryResolver.resolveComponentFactory(selector);

		let viewContainerRef = this.componentHost.viewContainerRef;
		viewContainerRef.clear();

		let injector = Injector.create([{ provide: COMPONENT_CONFIG, useValue: this.componentConfig }], this._injector);
		let componentRef: ComponentRef<IComponent>;
		try {
			componentRef = viewContainerRef.createComponent(componentFactory, 0, injector);
			this._componentInstance = componentRef.instance;
			this._componentInstance.descriptor = this.descriptor;
			this._componentInstance.modelStore = this.modelStore;
			this._changeref.detectChanges();
		} catch (e) {
			this.logService.error('Error rendering component: {0}', e);
			return;
		}
		let el = <HTMLElement>componentRef.location.nativeElement;

		// set widget styles to conform to its box
		el.style.overflow = 'hidden';
		el.style.position = 'relative';
	}
}
