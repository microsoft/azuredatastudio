/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerComponentInput, DesignerComponentType, DesignerEditTypes, DesignerTab, InputComponentInfo, InputComponentData } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelTab, IPanelView, ITabbedPanelStyles, TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { Orientation, Sizing, SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInputBoxStyles, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import 'vs/css!./media/designer';
import { ITableStyles } from 'sql/base/browser/ui/table/interfaces';
import { IDropdownStyles } from 'sql/base/browser/ui/dropdownList/dropdownList';
import { IThemable } from 'vs/base/common/styler';
import { ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';

export interface IDesignerStyle extends ITabbedPanelStyles, IInputBoxStyles, ITableStyles, IDropdownStyles, ICheckboxStyles {
}

export class Designer extends Disposable implements IThemable {

	private _horizontalSplitViewContainer: HTMLElement;
	private _verticalSplitViewContainer: HTMLElement;
	private _tabbedPanelContainer: HTMLElement;
	private _editorContainer: HTMLElement;
	private _horizontalSplitView: SplitView;
	private _verticalSplitView: SplitView;
	private _tabbedPanel: TabbedPanel;
	private _contentContainer: HTMLElement;
	private _topContentContainer: HTMLElement;
	private _propertiesPane: HTMLElement;
	private _styles: IDesignerStyle = {};

	private _componentMap: Map<string, any> = new Map<string, any>();
	private _input: DesignerComponentInput;

	constructor(private readonly _container: HTMLElement,
		private readonly _contextViewProvider: IContextViewProvider) {
		super();
		this._verticalSplitViewContainer = DOM.$('.designer-component');
		this._horizontalSplitViewContainer = DOM.$('.container');
		this._contentContainer = DOM.$('.content-container');
		this._topContentContainer = DOM.$('.top-content-container.components-grid');
		this._tabbedPanelContainer = DOM.$('.tabbed-panel-container');
		this._editorContainer = DOM.$('.editor-container');
		this._propertiesPane = DOM.$('.properties-container.components-grid');
		this._verticalSplitView = new SplitView(this._verticalSplitViewContainer, { orientation: Orientation.VERTICAL });
		this._horizontalSplitView = new SplitView(this._horizontalSplitViewContainer, { orientation: Orientation.HORIZONTAL });
		this._tabbedPanel = new TabbedPanel(this._tabbedPanelContainer);
		this._container.appendChild(this._verticalSplitViewContainer);
		this._contentContainer.appendChild(this._topContentContainer);
		this._contentContainer.appendChild(this._tabbedPanelContainer);
		this._verticalSplitView.addView({
			element: this._horizontalSplitViewContainer,
			layout: size => {
				this.layoutTabbedPanel();
			},
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._verticalSplitView.addView({
			element: this._editorContainer,
			layout: size => { },
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._contentContainer,
			layout: size => {
				this.layoutTabbedPanel();
			},
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._propertiesPane,
			layout: size => { },
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		const editor = DOM.$('div');
		editor.innerText = 'script pane placeholder';
		const properties = DOM.$('div');
		properties.innerText = 'properties pane placeholder';
		this._editorContainer.appendChild(editor);
		this._propertiesPane.appendChild(properties);
	}

	public style(styles: IDesignerStyle): void {
		this._styles = styles;
		this._componentMap.forEach((value, key, map) => {
			if (value.style) {
				value.style(styles);
			}
		});
		this._verticalSplitView.style({
			separatorBorder: styles.borderColor
		});

		this._horizontalSplitView.style({
			separatorBorder: styles.borderColor
		});
	}

	public layout(dimension: DOM.Dimension) {
		this._verticalSplitView.layout(dimension.height);
		this._horizontalSplitView.layout(dimension.width);
	}


	public async setInput(input: DesignerComponentInput): Promise<void> {
		this._input = input;
		await this.initializeDesignerView();
	}

	private async initializeDesignerView(): Promise<void> {
		DOM.clearNode(this._topContentContainer);
		const view = await this._input.getView();
		if (view.components) {
			view.components.forEach(component => {
				this.createComponent(this._topContentContainer, component);
			});
		}
		this._tabbedPanel.clearTabs();
		view.tabs.forEach(tab => {
			this._tabbedPanel.pushTab(this.createTabView(tab));
		});
		this.layoutTabbedPanel();
	}

	private layoutTabbedPanel() {
		this._tabbedPanel.layout(new DOM.Dimension(this._tabbedPanelContainer.clientWidth, this._tabbedPanelContainer.clientHeight));
	}

	private async handleEdit(edit): Promise<void> {
		const result = await this._input.processEdit(edit);
		const data = await this._input.getData();
		if (result.isValid) {
			//TODO: replace with actual implementation
			this._componentMap['name'].value = (<InputComponentData>data['name']).value;
		} else {
			//TODO: add error notification
		}
	}

	private createTabView(tab: DesignerTab): IPanelTab {
		const view = new DesignerTabPanelView(tab, (container, component) => {
			this.createComponent(container, component);
		});
		return {
			identifier: tab.title,
			title: tab.title,
			view: view
		};
	}

	private createComponent(container: HTMLElement, component: DesignerComponentType, labelOnTop?: boolean): void {
		const componentContainerClass = labelOnTop ? '.full-row' : '';
		container.appendChild(DOM.$(componentContainerClass)).innerText = component.title;
		const componentDiv = container.appendChild(DOM.$(componentContainerClass));
		switch (component.type) {
			case 'input':
				const inputComponentSpec = component as InputComponentInfo;
				const input = new InputBox(componentDiv, this._contextViewProvider, {
					ariaLabel: component.ariaLabel ?? component.title,
					type: inputComponentSpec.inputType,
				});
				this._componentMap.set(component.property, input);
				input.onDidChange((newValue) => {
					this.handleEdit({ type: DesignerEditTypes.Update, property: component.property, value: newValue });
				});
				input.style(this._styles);
				if (component.width !== undefined) {
					input.width = component.width;
				}
				break;
		}
	}
}

class DesignerTabPanelView extends Disposable implements IPanelView {

	constructor(private readonly _tab: DesignerTab, private _createComponent: (container: HTMLElement, component: DesignerComponentType, labelOnTop?: boolean) => void) {
		super();
	}

	render(container: HTMLElement): void {
		const componentsContainer = container.appendChild(DOM.$('.components-grid'));
		this._tab.components.forEach(component => {
			this._createComponent(componentsContainer, component, this._tab.labelOnTop);
		});
	}

	layout(dimension: DOM.Dimension): void {

	}
}
