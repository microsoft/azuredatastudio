/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

const packageJson = require('../package.json');
export const TelemetryReporter = new AdsTelemetryReporter(packageJson.name, packageJson.version, packageJson.aiKey);

export const BookTelemetryView = 'Book';

export enum NbTelemetryActions {
	OpenNotebook = 'NotebookOpened',
	OpenMarkdown = 'MarkdownOpened',
	OpenBook = 'BookOpened',
	CloseBook = 'BookClosed',
	TrustNotebook = 'TrustNotebook',
	SaveBook = 'BookSaved',
	CreateBook = 'BookCreated',
	PinNotebook = 'NotebookPinned',
	OpenNotebookFromBook = 'NotebookOpenedFromBook',
	MoveNotebook = 'MoveNotebook',
	DragAndDrop = 'DragAndDrop'
}

