/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/flexContainer';

import {
	ChangeDetectorRef, ViewChildren, ElementRef, OnDestroy, OnInit, QueryList
} from '@angular/core';

import * as types from 'vs/base/common/types';

import { IComponent, IComponentDescriptor, IModelStore, IComponentEventArgs, ComponentEventType } from 'sql/workbench/browser/modelComponents/interfaces';
import * as azdata from 'azdata';
import { Emitter } from 'vs/base/common/event';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { ModelComponentWrapper } from 'sql/workbench/browser/modelComponents/modelComponentWrapper.component';
import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';


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
		protected _changeRef: ChangeDetectorRef,
		protected _el: ElementRef) {
		super();
	}

	/// IComponent implementation

	abstract descriptor: IComponentDescriptor;
	abstract modelStore: IModelStore;
	protected _onEventEmitter = new Emitter<IComponentEventArgs>();

	public layout(): void {
		if (!this._changeRef['destroyed']) {
			this._changeRef.detectChanges();
		}
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

	getHtml(): any {
		return this._el.nativeElement;
	}

	public setDataProvider(handle: number, componentId: string, context: any): void {
	}

	public refreshDataProvider(item: any): void {
	}

	public updateStyles(): void {
		const element = (<HTMLElement>this._el.nativeElement);
		for (const style in this.CSSStyles) {
			element.style[style] = this.CSSStyles[style];
		}
	}

	public setProperties(properties: { [key: string]: any; }): void {
		properties = properties || {};
		this.properties = properties;
		this.updateStyles();
		this.layout();
		this.validate();
	}

	// Helper Function to update single property
	public updateProperty(key: string, value: any): void {
		if (key) {
			this.properties[key] = value;
			this.updateStyles();
			this.layout();
			this.validate();
		}
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
		return this.getPropertyOrDefault<azdata.ComponentProperties, number | string>((props) => props.height, undefined);
	}

	public set height(newValue: number | string) {
		this.setPropertyFromUI<azdata.ComponentProperties, number | string>((props, value) => props.height = value, newValue);
	}

	public get width(): number | string {
		return this.getPropertyOrDefault<azdata.ComponentProperties, number | string>((props) => props.width, undefined);
	}

	public set width(newValue: number | string) {
		this.setPropertyFromUI<azdata.ComponentProperties, number | string>((props, value) => props.width = value, newValue);
	}

	public get position(): string {
		return this.getPropertyOrDefault<azdata.ComponentProperties, string>((props) => props.position, '');
	}

	public set position(newValue: string) {
		this.setPropertyFromUI<azdata.ComponentProperties, string>((properties, position) => { properties.position = position; }, newValue);
	}

	public get CSSStyles(): { [key: string]: string } {
		return this.getPropertyOrDefault<azdata.ComponentProperties, { [key: string]: string }>((props) => props.CSSStyles, {});
	}

	public set CSSStyles(newValue: { [key: string]: string }) {
		this.setPropertyFromUI<azdata.ComponentProperties, { [key: string]: string }>((properties, CSSStyles) => { properties.CSSStyles = CSSStyles; }, newValue);
	}

	public convertSizeToNumber(size: number | string): number {
		if (size && typeof (size) === 'string') {
			if (size.toLowerCase().endsWith('px')) {
				return +size.replace('px', '');
			} else if (size.toLowerCase().endsWith('em')) {
				return +size.replace('em', '') * 11;
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

	protected fireEvent(event: IComponentEventArgs) {
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
		_changeRef: ChangeDetectorRef,
		_el: ElementRef
	) {
		super(_changeRef, _el);
		this.items = [];
		this._validations.push(() => this.items.every(item => {
			return this.modelStore.getComponent(item.descriptor.id).valid;
		}));
	}

	/// IComponent container-related implementation
	public addToContainer(componentDescriptor: IComponentDescriptor, config: any, index?: number): void {
		if (!componentDescriptor) {
			return;
		}
		if (this.items.some(item => item.descriptor.id === componentDescriptor.id && item.descriptor.type === componentDescriptor.type)) {
			return;
		}
		if (index !== undefined && index !== null && index >= 0 && index <= this.items.length) {
			this.items.splice(index, 0, new ItemDescriptor(componentDescriptor, config));
		} else if (!index) {
			this.items.push(new ItemDescriptor(componentDescriptor, config));
		} else {
			throw new Error(nls.localize('invalidIndex', "The index {0} is invalid.", index));
		}
		this.modelStore.eventuallyRunOnComponent(componentDescriptor.id, component => component.registerEventHandler(event => {
			if (event.eventType === ComponentEventType.validityChanged) {
				this.validate();
			}
		}));
		this._changeRef.detectChanges();
		return;
	}

	public removeFromContainer(componentDescriptor: IComponentDescriptor): boolean {
		if (!componentDescriptor) {
			return false;
		}
		let index = this.items.findIndex(item => item.descriptor.id === componentDescriptor.id && item.descriptor.type === componentDescriptor.type);
		if (index >= 0) {
			this.items.splice(index, 1);
			this._changeRef.detectChanges();
			return true;
		}
		return false;
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
