
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';
import {
	Component, Input, Inject, forwardRef, ComponentFactoryResolver, AfterContentInit, ViewChild,
	ElementRef, OnInit, ChangeDetectorRef, OnDestroy, ReflectiveInjector, Injector, Type, ComponentRef
} from '@angular/core';

import * as strings from 'vs/base/common/strings';
import { IModelStore, IComponentDescriptor, IComponent } from './interfaces';


class ModelBuilderImpl implements sqlops.ViewModelBuilder {

	createNavContainer(): sqlops.NavContainer {
		throw new Error('Method not implemented.');
	}

	createFlexContainer(): sqlops.FlexContainer {
		//
	}
	createCard(): sqlops.CardComponent {
		throw new Error('Method not implemented.');
	}
	createDashboardWidget(id: string): sqlops.CardComponent {
		throw new Error('Method not implemented.');
	}
	createDashboardWebview(id: string): sqlops.CardComponent {
		throw new Error('Method not implemented.');
	}
}

export class ComponentDescriptor implements IComponentDescriptor {

	constructor(public readonly id: string, public readonly selector: string) {

	}

}

export class ModelStore implements IModelStore {
	private static baseId = 0;

	private storeId: number;
	private nextComponentId: number;
	private _componentMappings: { [x: string]: IComponent } = {};
	constructor(
	) {
		this.storeId = ModelStore.baseId++;
		this.nextComponentId = 0;
		this._componentMappings = {};
	}

	private getNextComponentId(): string {
		return `component${this.storeId}_${this.nextComponentId++}`;
	}

	public createComponentDescriptor(selector: string): IComponentDescriptor {
		let id = this.getNextComponentId();
		return new ComponentDescriptor(id, selector);
	}

	registerComponent(component: IComponent): void {
		this._componentMappings[component.descriptor.id] = component;
	}
	unregisterComponent(component: IComponent): void {
		this._componentMappings[component.descriptor.id] = undefined;
		// TODO notify model for cleanup
	}
	getComponent(componentDescriptor: IComponentDescriptor): IComponent {
		return this._componentMappings[componentDescriptor.id];
	}
}