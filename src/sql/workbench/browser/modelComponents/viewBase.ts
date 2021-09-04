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
import { ILogService } from 'vs/platform/log/common/log';

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
	constructor(protected changeRef: ChangeDetectorRef, protected logService: ILogService) {
		super();
		this.modelStore = new ModelStore(logService);
	}

	// Properties needed by the model view code
	abstract id: string;
	abstract connection: azdata.connection.Connection;
	abstract serverInfo: azdata.ServerInfo;
	private _onEventEmitter = new Emitter<IModelViewEventArgs>();

	initializeModel(rootComponent: IComponentShape, validationCallback: (componentId: string) => Thenable<boolean>): void {
		let descriptor = this.defineComponent(rootComponent);
		this.logService.debug(`Initializing view ${this.id} with root component ${rootComponent.id}`);
		this.rootDescriptor = descriptor;
		this.modelStore.registerValidationCallback(validationCallback);
		// Kick off the build by detecting changes to the model
		if (!(this.changeRef['destroyed'])) {
			this.changeRef.detectChanges();
		}
	}

	private defineComponent(component: IComponentShape): IComponentDescriptor {
		this.logService.debug(`Defining component ${component.id} in view ${this.id}`);
		let existingDescriptor = this.modelStore.getComponentDescriptor(component.id);
		if (existingDescriptor) {
			this.logService.debug(`Component ${component.id} already defined`);
			return existingDescriptor;
		}
		let typeId = componentRegistry.getIdForTypeMapping(component.type);
		if (!typeId) {
			// failure case
			throw new Error(nls.localize('componentTypeNotRegistered', "Could not find component for type {0}", ModelComponentTypes[component.type]));
		}
		let descriptor = this.modelStore.createComponentDescriptor(typeId, component.id);
		this.setProperties(component.id, component.properties, true);
		this.setLayout(component.id, component.layout, true);
		this.registerEvent(component.id, true);
		if (component.itemConfigs) {
			const items = component.itemConfigs.map(itemConfig => {
				return {
					itemConfig,
					index: undefined,
					initial: true
				};
			});
			this.addToContainer(component.id, items, true);
		}

		return descriptor;
	}

	private removeComponent(component: IComponentShape): void {
		this.logService.debug(`Removing component ${component.id} from view ${this.id}`);
		if (component.itemConfigs) {
			for (let item of component.itemConfigs) {
				this.removeFromContainer(component.id, item);
			}
		}
	}

	clearContainer(componentId: string): void {
		this.logService.debug(`Queuing action to clear component ${componentId}`);
		this.queueAction(componentId, (component) => {
			if (!component.clearContainer) {
				this.logService.warn(`Trying to clear container ${componentId} but does not implement clearContainer!`);
				return;
			}
			this.logService.debug(`Clearing component ${componentId}`);
			component.clearContainer();
		});
	}

	addToContainer(containerId: string, items: { itemConfig: IItemConfig, index?: number }[], initial?: boolean): void {
		if (items.length === 0) {
			// If we don't have any items save ourselves the time and just exit early. This can happen when
			// an item is defined since we may have components definitions which have empty itemConfigs
			return;
		}
		const itemNames = items.map(item => item.itemConfig.componentShape.id).join(',');
		this.logService.debug(`Queueing action to add components ${itemNames} to container ${containerId}`);
		// Do not return the promise as this should be non-blocking
		this.queueAction(containerId, (component) => {
			if (!component.addToContainer) {
				this.logService.warn(`Container ${containerId} is trying to add components ${itemNames} but does not implement addToContainer!`);
				return;
			}
			this.logService.debug(`Adding components ${itemNames} to container ${containerId}`);
			const itemConfigs = items.map(item => {
				const componentDescriptor = this.defineComponent(item.itemConfig.componentShape);
				return {
					componentDescriptor,
					config: item.itemConfig.config,
					index: item.index
				};
			});

			component.addToContainer(itemConfigs);
		}, initial);
	}

	removeFromContainer(containerId: string, itemConfig: IItemConfig): void {
		this.logService.debug(`Queueing action to remove component ${itemConfig.componentShape.id} from container ${containerId}`);
		this.queueAction(containerId, (component) => {
			if (!component.removeFromContainer) {
				this.logService.warn(`Container ${containerId} is trying to remove component ${itemConfig.componentShape.id} but does not implement removeFromContainer!`);
				return;
			}
			this.logService.debug(`Removing component ${itemConfig.componentShape.id} from container ${containerId}`);
			component.removeFromContainer({ id: itemConfig.componentShape.id, type: componentRegistry.getIdForTypeMapping(itemConfig.componentShape.type) });
			this.removeComponent(itemConfig.componentShape);
		});
	}

	setLayout(componentId: string, layout: any, initial: boolean = false): void {
		if (!layout) {
			return;
		}
		this.logService.debug(`Queuing action to set layout for component ${componentId}`);
		this.queueAction(componentId, (component) => {
			this.logService.debug(`Setting layout for component ${componentId}. Layout : ${JSON.stringify(layout)}`);
			component.setLayout(layout);
		}, initial);
	}

	setItemLayout(containerId: string, itemConfig: IItemConfig): void {
		this.logService.debug(`Queuing action to set item layout for component ${itemConfig.componentShape.id} in container ${containerId}`);
		let childDescriptor = this.modelStore.getComponentDescriptor(itemConfig.componentShape.id);
		this.queueAction(containerId, (component) => {
			this.logService.debug(`Setting item layout for component ${itemConfig.componentShape.id} in container ${containerId}. Layout : ${JSON.stringify(itemConfig.config)}`);
			component.setItemLayout(childDescriptor, itemConfig.config);
		});
	}

	setProperties(componentId: string, properties: { [key: string]: any; }, initial: boolean = false): void {
		if (!properties) {
			return;
		}
		this.logService.debug(`Queuing action to set properties for component ${componentId}`);
		this.queueAction(componentId, (component) => {
			this.logService.debug(`Setting properties for component ${componentId}. Properties : ${JSON.stringify(properties)}`);
			component.setProperties(properties);
		}, initial);
	}

	refreshDataProvider(componentId: string, item: any): void {
		this.logService.debug(`Queuing action to refresh data provider for component ${componentId}`);
		this.queueAction(componentId, (component) => {
			this.logService.debug(`Refreshing data provider for component ${componentId}`);
			component.refreshDataProvider(item);
		});
	}

	private queueAction<T>(componentId: string, action: (component: IComponent) => T, initial: boolean = false): void {
		this.modelStore.eventuallyRunOnComponent(componentId, action, initial);
	}

	registerEvent(componentId: string, initial: boolean = false) {
		this.logService.debug(`Queuing action to register event handler for component ${componentId}`);
		this.queueAction(componentId, (component) => {
			this.logService.debug(`Registering event handler for component ${componentId}`);
			this._register(component.registerEventHandler(e => {
				let modelViewEvent: IModelViewEventArgs = assign({
					componentId: componentId,
					isRootComponent: componentId === this.rootDescriptor.id
				}, e);
				this._onEventEmitter.fire(modelViewEvent);
			}));
		}, initial);
	}

	public get onEvent(): Event<IModelViewEventArgs> {
		return this._onEventEmitter.event;
	}

	public validate(componentId: string): Promise<boolean> {
		return new Promise(resolve => this.modelStore.eventuallyRunOnComponent(componentId, component => resolve(component.validate()), false));
	}

	public setDataProvider(handle: number, componentId: string, context: any): any {
		return this.queueAction(componentId, (component) => component.setDataProvider(handle, componentId, context), false);
	}

	public focus(componentId: string): void {
		this.logService.debug(`Queuing action to focus component ${componentId}`);
		return this.queueAction(componentId, (component) => {
			this.logService.debug(`Focusing component ${componentId}`);
			component.focus();
		});
	}

	public doAction(componentId: string, action: string, ...args: any[]): void {
		this.logService.debug(`Queuing action to do action ${action} for component ${componentId}`);
		return this.queueAction(componentId, (component) => {
			this.logService.debug(`Doing action ${action} for component ${componentId}`);
			component.doAction(action, ...args);
		});
	}
}
