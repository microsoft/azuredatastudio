/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerTab } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Table } from 'sql/base/browser/ui/table/table';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { CreateComponentsFunc } from 'sql/base/browser/ui/designer/designer';
import { Event, Emitter } from 'vs/base/common/event';
import { IView } from 'vs/base/browser/ui/splitview/splitview';
import { clamp } from 'vs/base/common/numbers';

const ButtonHeight = 30;
const HorizontalPadding = 10;
const VerticalPadding = 20;

export class DesignerTabPanelView extends Disposable implements IPanelView {
	private _componentsContainer: HTMLElement;
	private _tables: Table<Slick.SlickData>[] = [];
	constructor(private readonly _tab: DesignerTab, private _createComponents: CreateComponentsFunc) {
		super();
		this._componentsContainer = DOM.$('.components-grid');
		const uiComponents = this._createComponents(this._componentsContainer, this._tab.components, component => component.propertyName);
		uiComponents.forEach(component => {
			if (component instanceof Table) {
				this._tables.push(component);
			}
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this._componentsContainer);
	}

	layout(dimension: DOM.Dimension): void {
		this._tables.forEach(table => {
			table.layout(new DOM.Dimension(dimension.width - HorizontalPadding, dimension.height - VerticalPadding - ButtonHeight));
		});
	}
}

export class DesignerTextEditorBasicView implements IView {
	public get element(): HTMLElement {
		return this._element;
	}
	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	private _collapsed = false;
	private size: number;
	private previousSize: number;
	private _minimumSize: number;
	public get minimumSize(): number {
		return this._minimumSize;
	}

	private _maximumSize: number;
	public get maximumSize(): number {
		return this._maximumSize;
	}

	constructor(
		private _defaultMinimumSize: number,
		private _defaultMaximumSize: number,
		private _layout: (size: number) => void,
		private _element: HTMLElement,
		private options: { headersize?: number } = {}
	) {
		this._minimumSize = _defaultMinimumSize;
		this._maximumSize = _defaultMaximumSize;
	}

	public layout(size: number): void {
		this.size = size;
		this._layout(size);
	}

	public set collapsed(val: boolean) {
		if (val !== this._collapsed && this.options.headersize) {
			this._collapsed = val;
			if (this.collapsed) {
				this.previousSize = this.size;
				this._minimumSize = this.options.headersize;
				this._maximumSize = this.options.headersize;
				this._onDidChange.fire(undefined);
			} else {
				this._maximumSize = this._defaultMaximumSize;
				this._minimumSize = this._defaultMinimumSize;
				this._onDidChange.fire(clamp(this.previousSize, this.minimumSize, this.maximumSize));
			}
		}
	}

	public get collapsed(): boolean {
		return this._collapsed;
	}
}
