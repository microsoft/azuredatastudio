
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ChangeDetectorRef } from '@angular/core';

import { Registry } from 'vs/platform/registry/common/platform';
import nls = require('vs/nls');

import * as sqlops from 'sqlops';
import { IModelStore, IComponentDescriptor, IComponent, IItemConfig, ModelComponentTypes, IComponentConfigurationShape } from './interfaces';
import { IDashboardModelView } from 'sql/services/dashboard/common/dashboardViewService';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ModelStore } from 'sql/parts/dashboard/contents/mvvm/modelStore';

const componentRegistry = <IComponentRegistry> Registry.as(Extensions.ComponentContribution);

/**
 * Provides common logic required for any implementation that hooks to a model provided by
 * the extension host
 */
export abstract class ViewBase extends AngularDisposable implements IDashboardModelView {
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

	setModel(componentId: string): void {
		let descriptor = this.modelStore.getComponentDescriptor(componentId);
		if (!descriptor) {
			throw new Error(nls.localize('componentNotRegistered', 'Component {0} must be registered before setting as the model', componentId));
		}
		this.rootDescriptor = descriptor;
		// Kick off the build by detecting changes to the model
		this.changeRef.detectChanges();
	}

	initializeModel(rootComponent: IComponentConfigurationShape): void {
		let descriptor = this.createComponent(rootComponent);
		this.rootDescriptor = descriptor;
		// Kick off the build by detecting changes to the model
		this.changeRef.detectChanges();
	}

	private createComponent(component: IComponentConfigurationShape): IComponentDescriptor {
		let typeId = componentRegistry.getIdForTypeMapping(component.type);
		if (typeId) {
			// failure case
			throw new Error(nls.localize('componentTypeNotRegistered', 'Could not find component for type {0}', ModelComponentTypes[component.type]));
		}
		let descriptor = this.modelStore.createComponentDescriptor(typeId);
		this.setProperties(component.id, component.properties);
		this.setLayout(component.id, component.layout);
		if (component.items) {
			for(let item of component.items) {
				this.addToContainer(component.id, item);
			}
		}
		return descriptor;
	}

	clearContainer(componentId: string): void {
		this.queueAction(componentId, (component)  => component.clearContainer());
	}

	addToContainer(containerId: string, itemConfig: IItemConfig): void {
		// Do not return the promise as this should be non-blocking
		this.queueAction(containerId, (component)  => {
			let childDescriptor = this.createComponent(itemConfig.component);
			component.addToContainer(childDescriptor, itemConfig.config);
		});
	}

	setLayout(componentId: string, layout: any): void {
		if (!layout) {
			return;
		}
		this.queueAction(componentId, (component)  => component.setLayout(layout));
	}

	setProperties(componentId: string, properties: { [key: string]: any; }): void {
		if (!properties) {
			return;
		}
		this.queueAction(componentId, (component)  => component.setProperties(properties));
	}

	private queueAction<T>(componentId: string, action: (component: IComponent) => T): void {
		this.modelStore.eventuallyRunOnComponent(componentId, action).catch(err => {
			// TODO add error handling
		});
	}
}