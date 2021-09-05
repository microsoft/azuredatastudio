/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/loadingComponent';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, OnDestroy, AfterViewInit, ElementRef
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { localize } from 'vs/nls';
import { ComponentEventType, IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { status } from 'vs/base/browser/ui/aria/aria';
import { ILogService } from 'vs/platform/log/common/log';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IDisposable } from 'vs/base/common/lifecycle';

@Component({
	selector: 'modelview-loadingComponent',
	template: `
		<div class="modelview-loadingComponent-container" aria-busy="true" *ngIf="loading" [ngStyle]="CSSStyles">
			<div class="modelview-loadingComponent-spinner" [title]="getStatusText()" #spinnerElement></div>
			<div *ngIf="showText" class="modelview-loadingComponent-status-text">{{getStatusText()}}</div>
		</div>
		<model-component-wrapper #childElement [descriptor]="_component" [modelStore]="modelStore" *ngIf="_component" [ngClass]="{'modelview-loadingComponent-content-loading': loading}">
		</model-component-wrapper>
	`
})
export default class LoadingComponent extends ComponentBase<azdata.LoadingComponentProperties> implements IComponent, OnDestroy, AfterViewInit {
	private _component: IComponentDescriptor;
	private _componentEventDisposable: IDisposable;

	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
		this._validations.push(() => {
			if (!this._component) {
				return true;
			}
			if (this.loading) {
				return false;
			}
			return this.modelStore.getComponent(this._component.id).validate();
		});
	}

	ngAfterViewInit(): void {
		this.setLayout();
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(): void {
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		const wasLoading = this.loading;
		super.setProperties(properties);
		if (wasLoading && !this.loading) {
			status(this.getStatusText());
		}
	}

	public get loading(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.loading, false);
	}

	public set loading(newValue: boolean) {
		this.setPropertyFromUI<boolean>((properties, value) => { properties.loading = value; }, newValue);
		this.layout();
	}

	public get showText(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.showText, false);
	}

	public get loadingText(): string {
		return this.getPropertyOrDefault<string>((props) => props.loadingText, localize('loadingMessage', "Loading"));
	}

	public get loadingCompletedText(): string {
		return this.getPropertyOrDefault<string>((props) => props.loadingCompletedText, localize('loadingCompletedMessage', "Loading completed"));
	}

	public addToContainer(items: { componentDescriptor: IComponentDescriptor }[]): void {
		this._component = items[0].componentDescriptor;
		this.modelStore.eventuallyRunOnComponent(this._component.id, (component) => {
			this._componentEventDisposable = component.registerEventHandler(async event => {
				if (event.eventType === ComponentEventType.validityChanged) {
					this.validate().catch(onUnexpectedError);
				}
			});
		}, false);
		this.layout();
	}

	public removeFromContainer(_componentDescriptor: IComponentDescriptor): void {
		this._component = undefined;
		this._componentEventDisposable.dispose();
		this.layout();
	}

	public getStatusText(): string {
		return this.loading ? this.loadingText : this.loadingCompletedText;
	}
}
