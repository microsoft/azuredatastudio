/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { OnInit, Component, Input, ElementRef, ViewChild } from '@angular/core';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IMimeComponent } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { MimeModel } from 'sql/workbench/services/notebook/browser/outputs/mimemodel';
import { getErrorMessage } from 'vs/base/common/errors';
import * as Plotly from 'plotly.js';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { IDimension } from 'vs/base/browser/dom';
type ObjectType = object;

interface FigureLayout extends ObjectType {
	width?: number;
	height?: number;
	autosize?: boolean;
}

interface Figure extends ObjectType {
	data: object[];
	layout: Partial<FigureLayout>;
}


@Component({
	selector: PlotlyOutputComponent.SELECTOR,
	template: `<div #output class="plotly-wrapper"></div>
		<pre *ngIf="hasError" class="p-Widget jp-RenderedText">{{errorText}}</pre>
	`
})
export class PlotlyOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'plotly-output';

	private static Plotly?: Promise<typeof Plotly>;

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _initialized: boolean = false;
	private _rendered: boolean = false;
	private _cellModel: ICellModel;
	private _bundleOptions: MimeModel.IOptions;
	private _plotDiv: Plotly.PlotlyHTMLElement;
	private _plotly: typeof Plotly;
	public errorText: string;

	constructor() {
		super();
	}

	@Input() set bundleOptions(value: MimeModel.IOptions) {
		this._bundleOptions = value;
		if (this._initialized) {
			this.renderPlotly();
		}
	}

	@Input() mimeType: string;

	get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() set cellModel(value: ICellModel) {
		this._cellModel = value;
		if (this._initialized) {
			this.renderPlotly();
		}
	}

	ngOnInit() {
		if (!PlotlyOutputComponent.Plotly) {
			PlotlyOutputComponent.Plotly = import('plotly.js-dist-min');
		}
		this._plotDiv = this.output.nativeElement;
		this._plotDiv.style.width = '100%';
		this.renderPlotly();
		this._initialized = true;

		this._register(getResizesObserver(this._plotDiv, undefined, () => {
			this.resize();
		})).startObserving();
	}

	renderPlotly(): void {
		if (this._rendered) {
			// just re-layout
			this.layout();
			return;
		}
		if (!this._bundleOptions || !this._cellModel || !this.mimeType) {
			return;
		}
		if (this.mimeType === 'text/vnd.plotly.v1+html') {
			// Do nothing - this is our way to ignore the offline init Plotly attempts to do via a <script> tag.
			// We have "handled" it by pulling in the plotly library into this component instead
			return;
		}
		this.errorText = undefined;
		const figure = this.getFigure(true);
		if (figure) {
			let config = { responsive: true };
			PlotlyOutputComponent.Plotly.then(plotly => {
				this._plotly = plotly;
				return plotly.newPlot(this._plotDiv, figure.data, figure.layout, config);
			}).catch(e => this.displayError(e));
		}
		this._rendered = true;
	}

	getFigure(showError: boolean): Figure {
		const figure = <Figure><any>this._bundleOptions.data[this.mimeType];
		if (typeof figure === 'string') {
			try {
				JSON.parse(figure);
			} catch (error) {
				if (showError) {
					this.displayError(error);
				}
			}
		}

		const { data = [], layout = {} } = figure;

		return { data, layout };
	}

	private displayError(error: Error | string): void {
		this.errorText = localize('plotlyError', "Error displaying Plotly graph: {0}", getErrorMessage(error));
	}

	layout(): void {
		// No need to re-layout for now as Plotly is doing its own resize handling.
	}

	private resize() {
		this._plotly.Plots.resize(this._plotDiv);
	}

	public hasError(): boolean {
		return !types.isUndefinedOrNull(this.errorText);
	}

}

// port the below code from vscode cellWidgets file since it was deleted
export interface IResizeObserver {
	startObserving: () => void;
	stopObserving: () => void;
	getWidth(): number;
	getHeight(): number;
	dispose(): void;
}

export class BrowserResizeObserver extends Disposable implements IResizeObserver {
	private readonly referenceDomElement: HTMLElement | null;

	private readonly observer: ResizeObserver;
	private width: number;
	private height: number;

	constructor(referenceDomElement: HTMLElement | null, dimension: IDimension | undefined, changeCallback: () => void) {
		super();

		this.referenceDomElement = referenceDomElement;
		this.width = -1;
		this.height = -1;

		this.observer = new ResizeObserver((entries: any) => {
			for (const entry of entries) {
				if (entry.target === referenceDomElement && entry.contentRect) {
					if (this.width !== entry.contentRect.width || this.height !== entry.contentRect.height) {
						this.width = entry.contentRect.width;
						this.height = entry.contentRect.height;
						DOM.scheduleAtNextAnimationFrame(() => {
							changeCallback();
						});
					}
				}
			}
		});
	}

	getWidth(): number {
		return this.width;
	}

	getHeight(): number {
		return this.height;
	}

	startObserving(): void {
		this.observer.observe(this.referenceDomElement!);
	}

	stopObserving(): void {
		this.observer.unobserve(this.referenceDomElement!);
	}

	override dispose(): void {
		this.observer.disconnect();
		super.dispose();
	}
}

export function getResizesObserver(referenceDomElement: HTMLElement | null, dimension: IDimension | undefined, changeCallback: () => void): IResizeObserver {
	return new BrowserResizeObserver(referenceDomElement, dimension, changeCallback);
}
