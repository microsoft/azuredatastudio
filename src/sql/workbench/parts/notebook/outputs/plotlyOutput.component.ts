/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { OnInit, Component, Input, Inject, ElementRef, ViewChild } from '@angular/core';
import * as Plotly from 'plotly.js-dist';
import { AngularDisposable } from 'sql/base/node/lifecycle';
import { IMimeComponent } from 'sql/workbench/parts/notebook/outputs/mimeRegistry';
import { MimeModel } from 'sql/workbench/parts/notebook/outputs/common/mimemodel';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { getErrorMessage } from 'sql/workbench/parts/notebook/notebookUtils';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';

type ObjectType = object;

interface Figure extends ObjectType {
	data: Plotly.Data[];
	layout: Partial<Plotly.Layout>;
}

declare class PlotlyHTMLElement extends HTMLDivElement {
	data: object;
	layout: object;
	newPlot: () => void;
	redraw: () => void;
}

@Component({
	selector: PlotlyOutputComponent.SELECTOR,
	template: `<div #output class="plotly-wrapper"></div>
		<pre *ngIf="hasError" class="p-Widget jp-RenderedText">{{errorText}}</pre>
	`
})
export class PlotlyOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'plotly-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _initialized: boolean = false;
	private _rendered: boolean = false;
	private _cellModel: ICellModel;
	private _bundleOptions: MimeModel.IOptions;
	private _plotDiv: PlotlyHTMLElement;
	public errorText: string;

	constructor(
		@Inject(IThemeService) private readonly themeService: IThemeService
	) {
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
		this._plotDiv = this.output.nativeElement;
		this.renderPlotly();
		this._initialized = true;
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
			figure.layout = figure.layout || {};
			if (!figure.layout.width && !figure.layout.autosize) {
				// Workaround: to avoid filling up the entire cell, use plotly's default
				figure.layout.width = Math.min(700, this._plotDiv.clientWidth);
			}
			try {
				Plotly.newPlot(this._plotDiv, figure.data, figure.layout);
			} catch (error) {
				this.displayError(error);
			}
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

		// The Plotly API *mutates* the figure to include a UID, which means
		// they won't take our frozen objects
		// if (Object.isFrozen(figure)) {
		//   return cloneDeep(figure) as Figure;
		// }

		const { data = [], layout = {} } = figure;

		return { data, layout };
	}

	private displayError(error: Error | string): void {
		this.errorText = localize('plotlyError', 'Error displaying Plotly graph: {0}', getErrorMessage(error));
	}

	layout(): void {
		// if (this.mimeType === 'text/vnd.plotly.v1+html') {
		// 	// Do nothing - this is our way to ignore the offline init Plotly attempts to do via a <script> tag.
		// 	// We have "handled" it by pulling in the plotly library into this component instead
		// 	return;
		// }
		// if (!this._initialized) {
		// 	// wait until initialized
		// 	return;
		// }
		// // Update graph
		// const figure = this.getFigure(false);
		// if (!this._plotDiv || !figure) {
		// 	return;
		// }
		// this._plotDiv.data = figure.data;
		// this._plotDiv.layout = figure.layout;
		// try {
		// 	Plotly.redraw(this._plotDiv);
		// } catch (error) {
		// 	this.displayError(error);
		// }
	}

	public hasError(): boolean {
		return !types.isUndefinedOrNull(this.errorText);
	}

}