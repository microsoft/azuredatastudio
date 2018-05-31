/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import FlexContainer from './flexContainer.component';
import FormContainer from './formContainer.component';
import ToolbarContainer from './toolbarContainer.component';
import GroupContainer from './groupContainer.component';
import CardComponent from './card.component';
import InputBoxComponent from './inputbox.component';
import DropDownComponent from './dropdown.component';
import ButtonComponent from './button.component';
import CheckBoxComponent from './checkbox.component';
import RadioButtonComponent from './radioButton.component';
import WebViewComponent from './webview.component';
import TextComponent from './text.component';
import { registerComponentType } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { ModelComponentTypes } from 'sql/workbench/api/common/sqlExtHostTypes';

export const FLEX_CONTAINER = 'flex-container';
registerComponentType(FLEX_CONTAINER, ModelComponentTypes.FlexContainer, FlexContainer);

export const FORM_CONTAINER = 'form-container';
registerComponentType(FORM_CONTAINER, ModelComponentTypes.Form, FormContainer);

export const TOOLBAR_CONTAINER = 'toolbar-container';
registerComponentType(TOOLBAR_CONTAINER, ModelComponentTypes.Toolbar, ToolbarContainer);

export const GROUP_CONTAINER = 'group-container';
registerComponentType(GROUP_CONTAINER, ModelComponentTypes.Group, GroupContainer);

export const CARD_COMPONENT = 'card-component';
registerComponentType(CARD_COMPONENT, ModelComponentTypes.Card, CardComponent);

export const INPUTBOX_COMPONENT = 'inputbox-component';
registerComponentType(INPUTBOX_COMPONENT, ModelComponentTypes.InputBox, InputBoxComponent);

export const DROPDOWN_COMPONENT = 'dropdown-component';
registerComponentType(DROPDOWN_COMPONENT, ModelComponentTypes.DropDown, DropDownComponent);

export const BUTTON_COMPONENT = 'button-component';
registerComponentType(BUTTON_COMPONENT, ModelComponentTypes.Button, ButtonComponent);


export const CHECKBOX_COMPONENT = 'checkbox-component';
registerComponentType(CHECKBOX_COMPONENT, ModelComponentTypes.CheckBox, CheckBoxComponent);

export const RADIOBUTTON_COMPONENT = 'radiobutton-component';
registerComponentType(RADIOBUTTON_COMPONENT, ModelComponentTypes.RadioButton, RadioButtonComponent);

export const WEBVIEW_COMPONENT = 'webview-component';
registerComponentType(WEBVIEW_COMPONENT, ModelComponentTypes.WebView, WebViewComponent);

export const TEXT_COMPONENT = 'text-component';
registerComponentType(TEXT_COMPONENT, ModelComponentTypes.Text, TextComponent);
