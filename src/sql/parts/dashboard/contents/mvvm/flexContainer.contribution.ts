/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import FlexContainer from './flexContainer.component';
import { registerComponentType } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { ModelComponentTypes } from 'sql/workbench/api/node/sqlExtHost.protocol';

export const FLEX_CONTAINER = 'flex-container';

registerComponentType(FLEX_CONTAINER, ModelComponentTypes.FlexContainer, FlexContainer);
