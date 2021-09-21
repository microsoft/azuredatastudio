/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerComponentInput, DesignerTab, InputComponent } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelTab, IPanelView, TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { Orientation, Sizing, SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable } from 'vs/base/common/lifecycle';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import 'vs/css!./media/designer';

export class Designer extends Disposable {

	private _horizontalSplitViewContainer: HTMLElement;
	private _verticalSplitViewContainer: HTMLElement;
	private _tabbedPanelContainer: HTMLElement;
	private _editorContainer: HTMLElement;
	private _horizontalSplitView: SplitView;
	private _verticalSplitView: SplitView;
	private _tabbedPanel: TabbedPanel;
	private _propertiesPane: HTMLElement;

	private _editor: InputBox;
	private _properties: InputBox;

	private _componentMap: Map<string, any> = new Map<string, any>();
	private _input: DesignerComponentInput;

	constructor(private readonly _container: HTMLElement,
		private readonly _contextViewProvider: IContextViewProvider) {
		super();
		this._verticalSplitViewContainer = DOM.$('.designer-component');
		this._horizontalSplitViewContainer = DOM.$('.container');
		this._tabbedPanelContainer = DOM.$('.container');
		this._editorContainer = DOM.$('.container');
		this._propertiesPane = DOM.$('.container');
		this._verticalSplitView = new SplitView(this._verticalSplitViewContainer, { orientation: Orientation.VERTICAL });
		this._horizontalSplitView = new SplitView(this._horizontalSplitViewContainer, { orientation: Orientation.HORIZONTAL });
		this._tabbedPanel = new TabbedPanel(this._tabbedPanelContainer);
		this._container.appendChild(this._verticalSplitViewContainer);
		this._verticalSplitView.addView({
			element: this._horizontalSplitViewContainer,
			layout: size => {
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
			element: this._tabbedPanelContainer,
			layout: size => {
				this._tabbedPanel.layout(new DOM.Dimension(size, DOM.getClientArea(this._horizontalSplitViewContainer).height));
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

		this._editor = new InputBox(this._editorContainer, this._contextViewProvider);
		this._properties = new InputBox(this._propertiesPane, this._contextViewProvider);
	}

	layout(dimension: DOM.Dimension) {
		this._verticalSplitView.layout(dimension.height);
		this._horizontalSplitView.layout(dimension.width);
	}

	public async setInput(input: DesignerComponentInput): Promise<void> {
		this._input = input;
		await this.initializeDesignerView();
	}

	private async initializeDesignerView(): Promise<void> {
		const view = await this._input.getView();
		this._tabbedPanel.clearTabs();
		view.tabs.forEach(tab => {
			this._tabbedPanel.pushTab(this.createTabView(tab));
		});

		this._editor.value = `editor - ${Date.now().toLocaleString()}`;
		this._properties.value = `properties - ${Date.now().toLocaleString()}`;
	}

	private createTabView(tab: DesignerTab): IPanelTab {
		return {
			identifier: tab.title,
			title: tab.title,
			view: new DesignerTabPanelView(tab, this._componentMap, this._contextViewProvider)
		};
	}
}

class DesignerTabPanelView implements IPanelView {
	constructor(private readonly _tab: DesignerTab,
		private readonly componentMap: Map<string, any>,
		private readonly _contextViewProvider: IContextViewProvider) {

	}

	render(container: HTMLElement): void {
		this._tab.components.forEach(component => {
			switch (component.type) {
				case 'input':
					const inputComponentSpec = component as InputComponent;
					const input = new InputBox(container, this._contextViewProvider, {
						ariaLabel: component.ariaLabel ?? component.title,
						type: inputComponentSpec.inputType
					});
					this.componentMap[component.property] = input;
					break;
			}
		});
	}

	layout(dimension: DOM.Dimension): void {

	}
}
