/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITaskDialogComponentParams } from 'sql/services/bootstrap/bootstrapParams';
/**
 * Interface for task dialog component events
 */
export interface ITaskDialogComponent {
	onOk(): void;

	onGenerateScript(): void;

	onCancel(): void;

	injectBootstapper(parameters: ITaskDialogComponentParams ): void;
}
