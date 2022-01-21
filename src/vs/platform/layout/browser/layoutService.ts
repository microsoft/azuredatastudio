/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDimension } from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const ILayoutService = createDecorator<ILayoutService>('layoutService');

export interface ILayoutService {

	readonly _serviceBrand: undefined;

	/**
	 * The dimensions of the container.
	 */
	readonly dimension: IDimension;

	/**
	 * Container of the application.
	 */
	readonly container: HTMLElement;

	/**
	 * An offset to use for positioning elements inside the container.
	 */
	readonly offset?: { top: number };

	/**
	 * An event that is emitted when the container is layed out. The
	 * event carries the dimensions of the container as part of it.
	 */
	readonly onDidLayout: Event<IDimension>;

	/**
	 * Focus the primary component of the container.
	 */
	focus(): void;
}
