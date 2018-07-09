/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, OnInit, QueryList
} from '@angular/core';

import * as types from 'vs/base/common/types';

import { IComponent, IComponentDescriptor, IModelStore, IComponentEventArgs, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import * as sqlops from 'sqlops';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { Event, Emitter } from 'vs/base/common/event';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import URI from 'vs/base/common/uri';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { createCSSRule, removeCSSRulesContainingSelector } from 'vs/base/browser/dom';


export type IUserFriendlyIcon = string | URI | { light: string | URI; dark: string | URI };

export class ItemDescriptor<T> {
	constructor(public descriptor: IComponentDescriptor, public config: T) { }
}

export abstract class ComponentBase extends Disposable implements IComponent, OnDestroy, OnInit {
	protected properties: { [key: string]: any; } = {};
	private _valid: boolean = true;
	protected _validations: (() => boolean | Thenable<boolean>)[] = [];
	private _eventQueue: IComponentEventArgs[] = [];
	constructor(
		protected _changeRef: ChangeDetectorRef) {
		super();
	}

	/// IComponent implementation

	abstract descriptor: IComponentDescriptor;
	abstract modelStore: IModelStore;
	protected _onEventEmitter = new Emitter<IComponentEventArgs>();

	public layout(): void {
		this._changeRef.detectChanges();
	}

	protected baseInit(): void {
		if (this.modelStore) {
			this.modelStore.registerComponent(this);
			this._validations.push(() => this.modelStore.validate(this));
		}
	}

	abstract ngOnInit(): void;

	protected baseDestroy(): void {
		if (this.modelStore) {
			this.modelStore.unregisterComponent(this);
		}
		this.dispose();
	}

	ngOnDestroy(): void {
		this.dispose();
	}

	abstract setLayout(layout: any): void;

	public setProperties(properties: { [key: string]: any; }): void {
		if (!properties) {
			this.properties = {};
		}
		this.properties = properties;
		this.layout();
		this.validate();
	}

	protected getProperties<TPropertyBag>(): TPropertyBag {
		return this.properties as TPropertyBag;
	}

	protected getPropertyOrDefault<TPropertyBag, TValue>(propertyGetter: (TPropertyBag) => TValue, defaultVal: TValue) {
		let property = propertyGetter(this.getProperties<TPropertyBag>());
		return types.isUndefinedOrNull(property) ? defaultVal : property;
	}

	protected setPropertyFromUI<TPropertyBag, TValue>(propertySetter: (TPropertyBag, TValue) => void, value: TValue) {
		propertySetter(this.getProperties<TPropertyBag>(), value);
		this.fireEvent({
			eventType: ComponentEventType.PropertiesChanged,
			args: this.getProperties()
		});
		this.validate();
	}

	public get enabled(): boolean {
		let properties = this.getProperties();
		let enabled = properties['enabled'];
		if (enabled === undefined) {
			enabled = true;
			properties['enabled'] = enabled;
		}
		return <boolean>enabled;
	}

	public set enabled(value: boolean) {
		let properties = this.getProperties();
		properties['enabled'] = value;
		this.setProperties(properties);
	}

	public get height(): number | string {
		return this.getPropertyOrDefault<sqlops.ComponentProperties, number | string>((props) => props.height, undefined);
	}

	public set height(newValue: number | string) {
		this.setPropertyFromUI<sqlops.ComponentProperties, number | string>((props, value) => props.height = value, newValue);
	}

	public get width(): number | string {
		return this.getPropertyOrDefault<sqlops.ComponentProperties, number | string>((props) => props.width, undefined);
	}

	public set width(newValue: number | string) {
		this.setPropertyFromUI<sqlops.ComponentProperties, number | string>((props, value) => props.width = value, newValue);
	}

	public convertSizeToNumber(size: number | string): number {
		if (size && typeof (size) === 'string') {
			if (size.toLowerCase().endsWith('px')) {
				return +size.replace('px', '');
			}

		} else if (!size) {
			return 0;
		}
		return +size;
	}

	protected getWidth(): string {
		return this.width ? this.convertSize(this.width) : '';
	}

	protected getHeight(): string {
		return this.height ? this.convertSize(this.height) : '';
	}

	public convertSize(size: number | string, defaultValue?: string): string {
		defaultValue = defaultValue || '';
		if (types.isUndefinedOrNull(size)) {
			return defaultValue;
		}
		let convertedSize: string = size ? size.toString() : defaultValue;
		if (!convertedSize.toLowerCase().endsWith('px') && !convertedSize.toLowerCase().endsWith('%')) {
			convertedSize = convertedSize + 'px';
		}
		return convertedSize;
	}

	public get valid(): boolean {
		return this._valid;
	}

	public registerEventHandler(handler: (event: IComponentEventArgs) => void): IDisposable {
		if (this._eventQueue) {
			while (this._eventQueue.length > 0) {
				let event = this._eventQueue.pop();
				handler(event);
			}
			this._eventQueue = undefined;
		}
		return this._onEventEmitter.event(handler);
	}

	private fireEvent(event: IComponentEventArgs) {
		this._onEventEmitter.fire(event);
		if (this._eventQueue) {
			this._eventQueue.push(event);
		}
	}

	public validate(): Thenable<boolean> {
		let validations = this._validations.map(validation => Promise.resolve(validation()));
		return Promise.all(validations).then(values => {
			let isValid = values.every(value => value === true);
			if (this._valid !== isValid) {
				this._valid = isValid;
				this.fireEvent({
					eventType: ComponentEventType.validityChanged,
					args: this._valid
				});
			}
			return isValid;
		});
	}
}

export abstract class ContainerBase<T> extends ComponentBase {
	protected items: ItemDescriptor<T>[];

	@ViewChildren(ModelComponentWrapper) protected _componentWrappers: QueryList<ModelComponentWrapper>;
	constructor(
		_changeRef: ChangeDetectorRef
	) {
		super(_changeRef);
		this.items = [];
		this._validations.push(() => this.items.every(item => {
			return this.modelStore.getComponent(item.descriptor.id).valid;
		}));
	}

	/// IComponent container-related implementation
	public addToContainer(componentDescriptor: IComponentDescriptor, config: any): void {
		if (this.items.some(item => item.descriptor.id === componentDescriptor.id && item.descriptor.type === componentDescriptor.type)) {
			return;
		}
		this.items.push(new ItemDescriptor(componentDescriptor, config));
		this.modelStore.eventuallyRunOnComponent(componentDescriptor.id, component => component.registerEventHandler(event => {
			if (event.eventType === ComponentEventType.validityChanged) {
				this.validate();
			}
		}));
		this._changeRef.detectChanges();
	}

	public clearContainer(): void {
		this.items = [];
		this._changeRef.detectChanges();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.items.forEach(item => {
			let component = this.modelStore.getComponent(item.descriptor.id);
			if (component) {
				component.enabled = this.enabled;
			}
		});
	}

	public layout(): void {
		if (this._componentWrappers) {
			this._componentWrappers.forEach(wrapper => {
				wrapper.layout();
			});
		}
		super.layout();
	}

	abstract setLayout(layout: any): void;
}
