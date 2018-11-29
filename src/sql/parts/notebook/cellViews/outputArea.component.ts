/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import 'vs/css!./outputArea';
import { nb } from 'sqlops';

import { OnInit, Component, Input, Inject, ElementRef, ViewChild, forwardRef, ChangeDetectorRef } from '@angular/core';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import * as themeColors from 'vs/workbench/common/theme';
import { IWorkbenchThemeService, IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { CellModel } from 'sql/parts/notebook/models/cell';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';

export const OUTPUT_AREA_SELECTOR: string = 'output-area-component';

@Component({
	selector: OUTPUT_AREA_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./outputArea.component.html'))
})
export class OutputAreaComponent extends AngularDisposable implements OnInit {
	@ViewChild('outputarea', { read: ElementRef }) private outputArea: ElementRef;
	@Input() cellModel: ICellModel;

	private readonly _minimumHeight = 30;

	constructor(
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		if (this.cellModel) {
			this.cellModel.onOutputsChanged(() => {
				this.rewriteOutputUrls();
				this._changeRef.detectChanges();
			});
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.outputArea.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	private rewriteOutputUrls() {
		// Only rewrite if this is coming back during execution, not when loading from disk.
		// A good approximation is that the model has a future (needed for execution)
		if (this.cellModel.future) {
			this.cellModel.outputs.forEach(output => {
				try {
					let result = output as nb.IDisplayResult;
					if (result && result.data && result.data['text/html']) {
						let nbm = (this.cellModel as CellModel).options.notebook as NotebookModel;
						if (nbm.hadoopConnection) {
							let host = nbm.hadoopConnection.host;
							let html = result.data['text/html'];
							html = html.replace(/(https?:\/\/mssql-master.*\/proxy)(.*)/g, function (a, b, c) {
								let ret = '';
								if (b !== '') {
									ret = 'https://' + host + ':30443/gateway/default/yarn/proxy';
								}
								if (c !== '') {
									ret = ret + c;
								}
								return ret;
							});
							(<nb.IDisplayResult>this.cellModel.outputs[1]).data['text/html'] = html;
						}
					}
				}
				catch (e) { }
			});
		}
	}
}
