/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InjectionToken } from '@angular/core';
import { IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';

export const COMPONENT_CONFIG = new InjectionToken<IComponentConfig>('component_config');

export interface IComponentConfig {
	descriptor: IComponentDescriptor;
	modelStore: IModelStore;
}

export interface ITitledComponent {
	title?: string;
}
