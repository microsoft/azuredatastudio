/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as sqlops from 'sqlops';

const PROFILER_SERVICE_ID = 'profilerService';
export const IProfilerService = createDecorator<IProfilerService>(PROFILER_SERVICE_ID);

export type ProfilerSessionID = string;

export const PROFILER_SESSION_TEMPLATE_SETTINGS = 'profiler.sessionTemplates';
export const PROFILER_SETTINGS = 'profiler';

/**
 * A front end provider for a profiler session
 */
export interface IProfilerSession {
	/**
	 * Called by the service when more rows are available to render
	 */
	onMoreRows(events: sqlops.ProfilerSessionEvents);
}

/**
 * A Profiler Service that handles session communication between the backends and frontends
 */
export interface IProfilerService {
	_serviceBrand: any;
	/**
	 * Registers a backend provider for profiler session. ex: mssql
	 */
	registerProvider(providerId: string, provider: sqlops.ProfilerProvider): void;
	/**
	 * Registers a session with the service that acts as the UI for a profiler session
	 * @returns An unique id that should be used to make subsequent calls to this service
	 */
	registerSession(uri: string, connectionProfile: IConnectionProfile, session: IProfilerSession): ProfilerSessionID;
	/**
	 * Connects the session specified by the id
	 */
	connectSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Disconnected the session specified by the id
	 */
	disconnectSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Starts the session specified by the id
	 */
	startSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Pauses the session specified by the id
	 */
	pauseSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Stops the session specified by the id
	 */
	stopSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * The method called by the service provider for when more rows are available to render
	 */
	onMoreRows(params: sqlops.ProfilerSessionEvents): void;
	/**
	 * Gets a list of the session templates that are specified in the settings
	 * @param provider An optional string to limit the session template to a specific
	 * @returns An array of session templates that match the provider passed, if passed, and generic ones (no provider specified),
	 * otherwise returns all session templates
	 */
	getSessionTemplates(providerId?: string): Array<IProfilerSessionTemplate>;
	/**
	 * Launches the dialog for editing the view columns of a profiler session template for the given input
	 * @param input input object that contains the necessary information which will be modified based on used input
	 */
	launchColumnEditor(input: ProfilerInput): Thenable<void>;
}

export interface IProfilerSettings {
	sessionTemplates: Array<IProfilerSessionTemplate>;
}

export interface IEventTemplate {
	name: string;
	optionalColumns: Array<string>;
}

export interface IEventViewTemplate {
	name: string;
	columns: Array<string>;
}

export interface ISessionViewTemplate {
	events: Array<IEventViewTemplate>;
}

export interface IProfilerSessionTemplate {
	name: string;
	events: Array<IEventTemplate>;
	view: ISessionViewTemplate;
}
