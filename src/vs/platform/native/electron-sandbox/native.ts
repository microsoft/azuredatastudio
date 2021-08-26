/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ICommonNativeHostService } from 'vs/platform/native/common/native';

export const INativeHostService = createDecorator<INativeHostService>('nativeHostService');

/**
 * A set of methods specific to a native host, i.e. unsupported in web
 * environments.
 *
 * @see {@link IHostService} for methods that can be used in native and web
 * hosts.
 */
export interface INativeHostService extends ICommonNativeHostService { }
