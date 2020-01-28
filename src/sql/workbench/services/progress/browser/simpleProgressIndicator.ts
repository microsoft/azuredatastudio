/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProgressIndicator, IProgressRunner } from 'vs/platform/progress/common/progress';

export class SimpleProgressIndicator implements IProgressIndicator {
	show(infinite: true, delay?: number): IProgressRunner;
	show(total: number, delay?: number): IProgressRunner;
	show(total: any, delay?: any) {
		return {
			total: (total: number) => {
			},

			worked: (worked: number) => {
			},

			done: () => {
			}
		};
	}

	async showWhile(promise: Promise<any>, delay?: number): Promise<void> {
		try {
			await promise;
		} catch (e) {

		}
	}

	_serviceBrand: undefined;
}
