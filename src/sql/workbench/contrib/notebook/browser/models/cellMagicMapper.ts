/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICellMagicMapper } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ILanguageMagic } from 'sql/workbench/services/notebook/browser/notebookService';
import { find } from 'vs/base/common/arrays';

const defaultKernel = '*';
export class CellMagicMapper implements ICellMagicMapper {
	private kernelToMagicMap = new Map<string, ILanguageMagic[]>();

	constructor(languageMagics: ILanguageMagic[]) {
		if (languageMagics) {
			for (let magic of languageMagics) {
				if (!magic.kernels || magic.kernels.length === 0) {
					this.addKernelMapping(defaultKernel, magic);
				}
				if (magic.kernels) {
					for (let kernel of magic.kernels) {
						this.addKernelMapping(kernel.toLowerCase(), magic);
					}
				}
			}
		}
	}

	private addKernelMapping(kernelId: string, magic: ILanguageMagic): void {
		let magics = this.kernelToMagicMap.get(kernelId) || [];
		magics.push(magic);
		this.kernelToMagicMap.set(kernelId, magics);
	}

	private findMagicForKernel(searchText: string, kernelId: string): ILanguageMagic | undefined {
		if (kernelId === undefined || !searchText) {
			return undefined;
		}
		kernelId = kernelId.toLowerCase();
		searchText = searchText.toLowerCase();
		let kernelMagics = this.kernelToMagicMap.get(kernelId) || [];
		if (kernelMagics) {
			return find(kernelMagics, m => m.magic.toLowerCase() === searchText);
		}
		return undefined;
	}

	toLanguageMagic(magic: string, kernelId: string): ILanguageMagic {
		let languageMagic = this.findMagicForKernel(magic, kernelId);
		if (!languageMagic) {
			languageMagic = this.findMagicForKernel(magic, defaultKernel);
		}
		return languageMagic;
	}
}
