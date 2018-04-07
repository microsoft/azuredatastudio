
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ChangeDetectorRef } from '@angular/core';

import { Registry } from 'vs/platform/registry/common/platform';
import nls = require('vs/nls');

import * as sqlops from 'sqlops';
import { IModelStore, IComponentDescriptor, IComponent } from './interfaces';
import { IDashboardModelView } from 'sql/services/dashboard/common/dashboardViewService';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { ModelComponentTypes } from 'sql/workbench/api/node/sqlExtHost.protocol';
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
		if (!this.modelStore.getComponentDescriptor(componentId)) {
			throw new Error(nls.localize('componentNotRegistered', 'Component {0} must be registered before setting as the model', componentId));
		}
		this.rootDescriptor = descriptor;
		// Kick off the build by detecting changes to the model
		this.changeRef.detectChanges();
	}

	createComponent(type: ModelComponentTypes, args: any): string {
		let typeId = componentRegistry.getIdForTypeMapping(type);
		if (typeId) {
			let descriptor = this.modelStore.createComponentDescriptor(typeId);
			return descriptor.id;
		}
		// failure case
		throw new Error(nls.localize('componentTypeNotRegistered', 'Could not find component for type {0}', ModelComponentTypes[type]));
	}

	clearContainer(componentId: string): void {
		this.runOnComponent(componentId, (component)  => component.clearContainer());
	}
	addToContainer(containerId: string, childComponentid: string, config: any): void {
		this.runOnComponent(containerId, (component)  => {
			let childDescriptor = this.modelStore.getComponentDescriptor(childComponentid);
			component.addToContainer(childDescriptor, config);
		});
	}
	setLayout(componentId: string, layout: any): void {
		this.runOnComponent(componentId, (component)  => component.setLayout(layout));
	}
	setProperties(componentId: string, properties: { [key: string]: any; }): void {
		this.runOnComponent(componentId, (component)  => component.setProperties(properties));
	}

	private runOnComponent<T>(componentId: string, action: (component: IComponent) => T): T {
		let component: IComponent = this.modelStore.getComponent(componentId);
		return component ? action(component) : undefined;
	}
}