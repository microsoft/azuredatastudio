/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import DivContainer from 'sql/workbench/browser/modelComponents/divContainer.component';
import FlexContainer from 'sql/workbench/browser/modelComponents/flexContainer.component';
import FormContainer from 'sql/workbench/browser/modelComponents/formContainer.component';
import ToolbarContainer from 'sql/workbench/browser/modelComponents/toolbarContainer.component';
import GroupContainer from 'sql/workbench/browser/modelComponents/groupContainer.component';
import CardComponent from 'sql/workbench/browser/modelComponents/card.component';
import InputBoxComponent from 'sql/workbench/browser/modelComponents/inputbox.component';
import DropDownComponent from 'sql/workbench/browser/modelComponents/dropdown.component';
import DeclarativeTableComponent from 'sql/workbench/browser/modelComponents/declarativeTable.component';
import ListBoxComponent from 'sql/workbench/browser/modelComponents/listbox.component';
import ButtonComponent from 'sql/workbench/browser/modelComponents/button.component';
import CheckBoxComponent from 'sql/workbench/browser/modelComponents/checkbox.component';
import TreeComponent from 'sql/workbench/browser/modelComponents/tree.component';
import RadioButtonComponent from 'sql/workbench/browser/modelComponents/radioButton.component';
import WebViewComponent from 'sql/workbench/contrib/modelView/browser/webview.component';
import TableComponent from 'sql/workbench/browser/modelComponents/table.component';
import TextComponent from 'sql/workbench/browser/modelComponents/text.component';
import ImageComponent from 'sql/workbench/browser/modelComponents/image.component';
import LoadingComponent from 'sql/workbench/browser/modelComponents/loadingComponent.component';
import FileBrowserTreeComponent from 'sql/workbench/browser/modelComponents/fileBrowserTree.component';
import EditorComponent from 'sql/workbench/browser/modelComponents/editor.component';
import DiffEditorComponent from 'sql/workbench/browser/modelComponents/diffeditor.component';
import DomComponent from 'sql/workbench/browser/modelComponents/dom.component';
import { registerComponentType } from 'sql/platform/dashboard/browser/modelComponentRegistry';
import HyperlinkComponent from 'sql/workbench/browser/modelComponents/hyperlink.component';
import SplitViewContainer from 'sql/workbench/browser/modelComponents/splitviewContainer.component';
import RadioCardGroup from 'sql/workbench/browser/modelComponents/radioCardGroup.component';
import TabbedPanelComponent from 'sql/workbench/browser/modelComponents/tabbedPanel.component';
import SeparatorComponent from 'sql/workbench/browser/modelComponents/separator.component';
import { ModelComponentTypes } from 'sql/platform/dashboard/browser/interfaces';
import PropertiesContainerComponent from 'sql/workbench/browser/modelComponents/propertiesContainer.component';
export const DIV_CONTAINER = 'div-container';
registerComponentType(DIV_CONTAINER, ModelComponentTypes.DivContainer, DivContainer);

export const FLEX_CONTAINER = 'flex-container';
registerComponentType(FLEX_CONTAINER, ModelComponentTypes.FlexContainer, FlexContainer);

export const SPLITVIEW_CONTAINER = 'splitView-container';
registerComponentType(SPLITVIEW_CONTAINER, ModelComponentTypes.SplitViewContainer, SplitViewContainer);

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

export const DECLARATIVETABLE_COMPONENT = 'declarativeTable-component';
registerComponentType(DECLARATIVETABLE_COMPONENT, ModelComponentTypes.DeclarativeTable, DeclarativeTableComponent);

export const LISTBOX_COMPONENT = 'listbox-component';
registerComponentType(LISTBOX_COMPONENT, ModelComponentTypes.ListBox, ListBoxComponent);

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

export const IMAGE_COMPONENT = 'image-component';
registerComponentType(IMAGE_COMPONENT, ModelComponentTypes.Image, ImageComponent);

export const TABLE_COMPONENT = 'table-component';
registerComponentType(TABLE_COMPONENT, ModelComponentTypes.Table, TableComponent);

export const LOADING_COMPONENT = 'loading-component';
registerComponentType(LOADING_COMPONENT, ModelComponentTypes.LoadingComponent, LoadingComponent);

export const TREE_COMPONENT = 'tree-component';
registerComponentType(TREE_COMPONENT, ModelComponentTypes.TreeComponent, TreeComponent);

export const FILEBROWSERTREE_COMPONENT = 'filebrowsertree-component';
registerComponentType(FILEBROWSERTREE_COMPONENT, ModelComponentTypes.FileBrowserTree, FileBrowserTreeComponent);

export const EDITOR_COMPONENT = 'editor-component';
registerComponentType(EDITOR_COMPONENT, ModelComponentTypes.Editor, EditorComponent);

export const DIFF_EDITOR_COMPONENT = 'diff-editor-component';
registerComponentType(DIFF_EDITOR_COMPONENT, ModelComponentTypes.DiffEditor, DiffEditorComponent);

export const DOM_COMPONENT = 'dom-component';
registerComponentType(DOM_COMPONENT, ModelComponentTypes.Dom, DomComponent);

export const HYPERLINK_COMPONENT = 'hyperlink-component';
registerComponentType(HYPERLINK_COMPONENT, ModelComponentTypes.Hyperlink, HyperlinkComponent);

export const RADIOCARDGROUP_COMPONENT = 'radiocardgroup-component';
registerComponentType(RADIOCARDGROUP_COMPONENT, ModelComponentTypes.RadioCardGroup, RadioCardGroup);

export const TABBEDPANEL_COMPONENT = 'tabbedpanel-component';
registerComponentType(TABBEDPANEL_COMPONENT, ModelComponentTypes.TabbedPanel, TabbedPanelComponent);

export const SEPARATOR_COMPONENT = 'separator-component';
registerComponentType(SEPARATOR_COMPONENT, ModelComponentTypes.Separator, SeparatorComponent);

export const PROPERTIESCONTAINER_COMPONENT = 'propertiescontainer-component';
registerComponentType(PROPERTIESCONTAINER_COMPONENT, ModelComponentTypes.PropertiesContainer, PropertiesContainerComponent);
