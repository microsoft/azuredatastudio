/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import FlexContainer from './flexContainer.component';
import CardComponent from './card.component';
import InputBoxComponent from './inputbox.component';
import { registerComponentType } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { ModelComponentTypes } from 'sql/workbench/api/common/sqlExtHostTypes';

export const FLEX_CONTAINER = 'flex-container';
registerComponentType(FLEX_CONTAINER, ModelComponentTypes.FlexContainer, FlexContainer);

export const CARD_COMPONENT = 'card-component';
registerComponentType(CARD_COMPONENT, ModelComponentTypes.Card, CardComponent);

export const INPUTBOX_COMPONENT = 'inputbox-component';
registerComponentType(INPUTBOX_COMPONENT, ModelComponentTypes.InputBox, InputBoxComponent);
