/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChangeDetectorRef } from '@angular/core';

import { Registry } from 'vs/platform/registry/common/platform';
import * as nls from 'vs/nls';

import * as azdata from 'azdata';
import { IModelView, IModelViewEventArgs, IComponentShape, IItemConfig } from 'sql/platform/model/browser/modelViewService';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/browser/modelComponentRegistry';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { ModelStore } from 'sql/workbench/browser/modelComponents/modelStore';
import { Event, Emitter } from 'vs/base/common/event';
import { assign } from 'vs/base/common/objects';
import { IModelStore, IComponentDescriptor, IComponent, ModelComponentTypes } from 'sql/platform/dashboard/browser/interfaces';

const componentRegistry = <IComponentRegistry>Registry.as(Extensions.ComponentContribution);

/**
 * Provides common logic required for any implementation that hooks to a model provided by
 * the extension host
 */
export abstract class ViewBase extends AngularDisposable implements IModelView {
	protected readonly modelStore: IModelStore;
	protected rootDescriptor: IComponentDescriptor;
	protected _onDestroy = new Emitter<void>();
	public readonly onDestroy = this._onDestroy.event;
	constructor(protected changeRef: ChangeDetectorRef) {
		super();
		this.modelStore = new ModelStore();
	}

	// Properties needed by the model view code
	abstract id: string;
	abstract connection: azdata.connection.Connection;
	abstract serverInfo: azdata.ServerInfo;
	private _onEventEmitter = new Emitter<IModelViewEventArgs>();

	initializeModel(rootComponent: IComponentShape, validationCallback: (componentId: string) => Thenable<boolean>): void {
		let descriptor = this.defineComponent(rootComponent);
		this.rootDescriptor = descriptor;
		this.modelStore.registerValidationCallback(validationCallback);
		// Kick off the build by detecting changes to the model
		this.changeRef.detectChanges();
	}

	private defineComponent(component: IComponentShape): IComponentDescriptor {
		let existingDescriptor = this.modelStore.getComponentDescriptor(component.id);
		if (existingDescriptor) {
			return existingDescriptor;
		}
		let typeId = componentRegistry.getIdForTypeMapping(component.type);
		if (!typeId) {
			// failure case
			throw new Error(nls.localize('componentTypeNotRegistered', "Could not find component for type {0}", ModelComponentTypes[component.type]));
		}
		let descriptor = this.modelStore.createComponentDescriptor(typeId, component.id);
		this.setProperties(component.id, component.properties);
		this.setLayout(component.id, component.layout);
		this.registerEvent(component.id);
		if (component.itemConfigs) {
			for (let item of component.itemConfigs) {
				this.addToContainer(component.id, item);
			}
		}

		return descriptor;
	}

	private removeComponent(component: IComponentShape): void {
		if (component.itemConfigs) {
			for (let item of component.itemConfigs) {
				this.removeFromContainer(component.id, item);
			}
		}
	}

	clearContainer(componentId: string): void {
		this.queueAction(componentId, (component) => component.clearContainer());
	}

	addToContainer(containerId: string, itemConfig: IItemConfig, index?: number): void {
		// Do not return the promise as this should be non-blocking
		this.queueAction(containerId, (component) => {
			let childDescriptor = this.defineComponent(itemConfig.componentShape);
			component.addToContainer(childDescriptor, itemConfig.config, index);
		});
	}

	removeFromContainer(containerId: string, itemConfig: IItemConfig): void {
		let childDescriptor = this.modelStore.getComponentDescriptor(itemConfig.componentShape.id);
		this.queueAction(containerId, (component) => {
			component.removeFromContainer(childDescriptor);
			this.removeComponent(itemConfig.componentShape);
		});
	}

	setLayout(componentId: string, layout: any): void {
		if (!layout) {
			return;
		}
		this.queueAction(componentId, (component) => component.setLayout(layout));
	}

	setItemLayout(containerId: string, itemConfig: IItemConfig): void {
		let childDescriptor = this.modelStore.getComponentDescriptor(itemConfig.componentShape.id);
		this.queueAction(containerId, (component) => {
			component.setItemLayout(childDescriptor, itemConfig.config);
		});
	}

	setProperties(componentId: string, properties: { [key: string]: any; }): void {
		if (!properties) {
			return;
		}
		this.queueAction(componentId, (component) => component.setProperties(properties));
	}

	refreshDataProvider(componentId: string, item: any): void {
		this.queueAction(componentId, (component) => component.refreshDataProvider(item));
	}

	private queueAction<T>(componentId: string, action: (component: IComponent) => T): void {
		this.modelStore.eventuallyRunOnComponent(componentId, action).catch(err => {
			// TODO add error handling
		});
	}

	registerEvent(componentId: string) {
		this.queueAction(componentId, (component) => {
			this._register(component.registerEventHandler(e => {
				let modelViewEvent: IModelViewEventArgs = assign({
					componentId: componentId,
					isRootComponent: componentId === this.rootDescriptor.id
				}, e);
				this._onEventEmitter.fire(modelViewEvent);
			}));
		});
	}

	public get onEvent(): Event<IModelViewEventArgs> {
		return this._onEventEmitter.event;
	}

	public validate(componentId: string): Thenable<boolean> {
		return new Promise(resolve => this.modelStore.eventuallyRunOnComponent(componentId, component => resolve(component.validate())));
	}

	public setDataProvider(handle: number, componentId: string, context: any): any {
		return this.queueAction(componentId, (component) => component.setDataProvider(handle, componentId, context));
	}

	public focus(componentId: string): void {
		return this.queueAction(componentId, (component) => component.focus());
	}

	public doAction(componentId: string, action: string, ...args: any[]): void {
		return this.queueAction(componentId, (component) => component.doAction(action, ...args));
	}
}
