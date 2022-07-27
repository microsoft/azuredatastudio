/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter, { TelemetryEventMeasures, TelemetryEventProperties } from '@microsoft/ads-extension-telemetry';

const packageJson = require('../package.json');
export const TelemetryReporter = new AdsTelemetryReporter(packageJson.name, packageJson.version, packageJson.aiKey);

export enum NbTelemetryView {
	Book = 'Book',
	Jupyter = 'Jupyter'
}

export enum NbTelemetryAction {
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
	DragAndDrop = 'DragAndDrop',
	AddRemoteBook = 'AddRemoteBook',
	JupyterServerStarted = 'JupyterServerStarted'
}

export function sendNotebookActionEvent(telemetryView: NbTelemetryView, telemetryAction: NbTelemetryAction, additionalProps?: TelemetryEventProperties, additionalMeasurements?: TelemetryEventMeasures): void {
	TelemetryReporter.createActionEvent(telemetryView, telemetryAction)
		.withAdditionalProperties(additionalProps)
		.withAdditionalMeasurements(additionalMeasurements)
		.send();
}

