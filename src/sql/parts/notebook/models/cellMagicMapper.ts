
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import { ICellMagicMapper, LanguageMagic } from 'sql/parts/notebook/models/modelInterfaces';

const defaultKernel = '*';
export class CellMagicMapper implements ICellMagicMapper {
	private kernelToMagicMap = new Map<string,LanguageMagic[]>();

	constructor(languageMagics: LanguageMagic[]) {
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

	private addKernelMapping(kernelId: string, magic: LanguageMagic): void {
		let magics = this.kernelToMagicMap.get(kernelId) || [];
		magics.push(magic);
		this.kernelToMagicMap.set(kernelId, magics);

	}

	private findMagicForKernel(searchText: string, kernelId: string): LanguageMagic | undefined {
		if (kernelId === undefined) {
			return undefined;
		}
		searchText = searchText.toLowerCase();
		let kernelMagics = this.kernelToMagicMap.get(kernelId) || [];
		if (kernelMagics) {
			return kernelMagics.find(m => m.magic.toLowerCase() === searchText);
		}
		return undefined;
	}

	toLanguageMagic(magic: string, kernelId: string): LanguageMagic {
		let languageMagic = this.findMagicForKernel(magic, kernelId.toLowerCase());
		if (!languageMagic) {
			languageMagic = this.findMagicForKernel(magic, defaultKernel);
		}
		return languageMagic;
	}
}
