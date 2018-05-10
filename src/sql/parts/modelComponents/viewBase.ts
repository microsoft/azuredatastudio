
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ChangeDetectorRef } from '@angular/core';

import { Registry } from 'vs/platform/registry/common/platform';
import nls = require('vs/nls');

import * as sqlops from 'sqlops';
import { IModelStore, IComponentDescriptor, IComponent, IComponentEventArgs } from './interfaces';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IModelView } from 'sql/services/model/modelViewService';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ModelStore } from 'sql/parts/modelComponents/modelStore';
import Event, { Emitter } from 'vs/base/common/event';

const componentRegistry = <IComponentRegistry>Registry.as(Extensions.ComponentContribution);

/**
 * Provides common logic required for any implementation that hooks to a model provided by
 * the extension host
 */
export abstract class ViewBase extends AngularDisposable implements IModelView {
	protected readonly modelStore: IModelStore;
	protected rootDescriptor: IComponentDescriptor;
	constructor(protected changeRef: ChangeDetectorRef) {
		super();
		this.modelStore = new ModelStore();
	}

	// Properties needed by the model view code
	abstract id: string;
	abstract connection: sqlops.connection.Connection;
	abstract serverInfo: sqlops.ServerInfo;
	private _onEventEmitter = new Emitter<any>();


	initializeModel(rootComponent: IComponentShape): void {
		let descriptor = this.defineComponent(rootComponent);
		this.rootDescriptor = descriptor;
		// Kick off the build by detecting changes to the model
		this.changeRef.detectChanges();
	}

	private defineComponent(component: IComponentShape): IComponentDescriptor {
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

	clearContainer(componentId: string): void {
		this.queueAction(componentId, (component) => component.clearContainer());
	}

	addToContainer(containerId: string, itemConfig: IItemConfig): void {
		// Do not return the promise as this should be non-blocking
		this.queueAction(containerId, (component) => {
			let childDescriptor = this.defineComponent(itemConfig.componentShape);
			component.addToContainer(childDescriptor, itemConfig.config);
		});
	}

	setLayout(componentId: string, layout: any): void {
		if (!layout) {
			return;
		}
		this.queueAction(componentId, (component) => component.setLayout(layout));
	}

	setProperties(componentId: string, properties: { [key: string]: any; }): void {
		if (!properties) {
			return;
		}
		this.queueAction(componentId, (component) => component.setProperties(properties));
	}

	setValid(componentId: string, valid: boolean): void {
		this.queueAction(componentId, (component) => component.setValid(valid));
	}

	private queueAction<T>(componentId: string, action: (component: IComponent) => T): void {
		this.modelStore.eventuallyRunOnComponent(componentId, action).catch(err => {
			// TODO add error handling
		});
	}

	registerEvent(componentId: string) {
		this.queueAction(componentId, (component) => {
			this._register(component.registerEventHandler(e => {
				e.componentId = componentId;
				this._onEventEmitter.fire(e);
			}));
		});
	}

	public get onEvent(): Event<IComponentEventArgs> {
		return this._onEventEmitter.event;
	}
}