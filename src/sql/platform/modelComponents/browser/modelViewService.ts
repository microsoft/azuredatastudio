/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

import { IModelView } from 'sql/platform/model/browser/modelViewService';

export const SERVICE_ID = 'modelViewService';

export interface IModelViewService {
	_serviceBrand: undefined;
	onRegisteredModelView: Event<IModelView>;
	registerModelView(widget: IModelView): void;
}

export const IModelViewService = createDecorator<IModelViewService>(SERVICE_ID);
