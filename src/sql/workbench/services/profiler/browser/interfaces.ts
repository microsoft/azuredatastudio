/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';
import { INewProfilerState } from 'sql/workbench/common/editor/profiler/profilerState';

const PROFILER_SERVICE_ID = 'profilerService';
export const IProfilerService = createDecorator<IProfilerService>(PROFILER_SERVICE_ID);

export type ProfilerSessionID = string;

export const PROFILER_VIEW_TEMPLATE_SETTINGS = 'profiler.viewTemplates';
export const PROFILER_SESSION_TEMPLATE_SETTINGS = 'profiler.sessionTemplates';
export const PROFILER_FILTER_SETTINGS = 'profiler.filters';
export const PROFILER_SETTINGS = 'profiler';

/**
 * A front end provider for a profiler session
 */
export interface IProfilerSession {
	/**
	 * Called by the service when more rows are available to render
	 */
	onMoreRows(events: azdata.ProfilerSessionEvents);
	/**
	 * Called by the service when the session is closed unexpectedly
	 */
	onSessionStopped(events: azdata.ProfilerSessionStoppedParams);
	/**
	 * Called by the service when a new profiler session is created by the dialog
	 */
	onProfilerSessionCreated(events: azdata.ProfilerSessionCreatedParams);
	/**
	 * Called by the service when the session state is changed
	 */
	onSessionStateChanged(newState: INewProfilerState);
}

/**
 * A Profiler Service that handles session communication between the backends and frontends
 */
export interface IProfilerService {
	_serviceBrand: undefined;
	/**
	 * Registers a backend provider for profiler session. ex: mssql
	 */
	registerProvider(providerId: string, provider: azdata.ProfilerProvider): void;
	/**
	 * Registers a session with the service that acts as the UI for a profiler session
	 * @returns An unique id that should be used to make subsequent calls to this service
	 */
	registerSession(uri: string, connectionProfile: IConnectionProfile, session: IProfilerSession): Promise<ProfilerSessionID>;
	/**
	 * Connects the session specified by the id
	 */
	connectSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Disconnected the session specified by the id
	 */
	disconnectSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Creates a new session using the given create statement and session name
	 */
	createSession(id: string, createStatement: string, template: azdata.ProfilerSessionTemplate): Thenable<boolean>;
	/**
	 * Starts the session specified by the id
	 */
	startSession(sessionId: ProfilerSessionID, sessionName: string): Thenable<boolean>;
	/**
	 * Pauses the session specified by the id
	 */
	pauseSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Stops the session specified by the id
	 */
	stopSession(sessionId: ProfilerSessionID): Thenable<boolean>;
	/**
	 * Gets a list of running XEvent sessions on the Profiler Session's target
	 */
	getXEventSessions(sessionId: ProfilerSessionID): Thenable<string[]>;
	/**
	 * The method called by the service provider for when more rows are available to render
	 */
	onMoreRows(params: azdata.ProfilerSessionEvents): void;
	/**
	 * The method called by the service provider for when more rows are available to render
	 */
	onSessionStopped(params: azdata.ProfilerSessionStoppedParams): void;
	/**
	 * Called by the service when a new profiler session is created by the dialog
	 */
	onProfilerSessionCreated(events: azdata.ProfilerSessionCreatedParams);
	/**
	 * Gets a list of the view templates that are specified in the settings
	 * @param provider An optional string to limit the view templates to a specific provider
	 * @returns An array of view templates that match the provider passed, if passed, and generic ones (no provider specified),
	 * otherwise returns all view templates
	 */
	getViewTemplates(providerId?: string): Array<IProfilerViewTemplate>;
	/**
	 * Gets a list of the session templates that are specified in the settings
	 * @param provider An optional string to limit the session template to a specific
	 * @returns An array of session templates that match the provider passed, if passed, and generic ones (no provider specified),
	 * otherwise returns all session templates
	 */
	getSessionTemplates(providerId?: string): Array<IProfilerSessionTemplate>;
	/**
	 * Gets the session view state
	 * @param sessionId The session ID to get the view state for
	 * @returns Sessions view state
	 */
	getSessionViewState(sessionId: string): any;
	/**
	 * Launches the dialog for editing the view columns of a profiler session template for the given input
	 * @param input input object that contains the necessary information which will be modified based on used input
	 */
	launchColumnEditor(input: ProfilerInput): Thenable<void>;
	/**
	 * Launches the dialog for creating a new XEvent session from a template
	 * @param input input object that contains the necessary information which will be modified based on used input
	 */
	launchCreateSessionDialog(input: ProfilerInput): Thenable<void>;
	/**
	 * Launches the dialog for collecting the filter object
	 * @param input input object
	 */
	launchFilterSessionDialog(input: ProfilerInput): void;
	/**
	 * Gets the filters
	 */
	getFilters(): Array<ProfilerFilter>;
	/**
	 * Saves the filter
	 * @param filter filter object
	 */
	saveFilter(filter: ProfilerFilter): Promise<void>;
}

export interface IProfilerSettings {
	viewTemplates: Array<IProfilerViewTemplate>;
	sessionTemplates: Array<IProfilerSessionTemplate>;
	filters: Array<ProfilerFilter>;
}

export interface IColumnViewTemplate {
	name: string;
	eventsMapped: Array<string>;
}

export interface IProfilerViewTemplate {
	name: string;
	columns: Array<IColumnViewTemplate>;
}

export enum EngineType {
	AzureSQLDB = 'AzureSQLDB',
	Standalone = 'Standalone'
}

export interface IProfilerSessionTemplate {
	name: string;
	engineTypes?: EngineType[];
	defaultView: string;
	createStatement: string;
}

export interface ProfilerFilter {
	name?: string;
	clauses: ProfilerFilterClause[];
}

export interface ProfilerFilterClause {
	field: string;
	operator: ProfilerFilterClauseOperator;
	value: string;
}

export enum ProfilerFilterClauseOperator {
	Equals,
	NotEquals,
	LessThan,
	LessThanOrEquals,
	GreaterThan,
	GreaterThanOrEquals,
	IsNull,
	IsNotNull,
	Contains,
	NotContains,
	StartsWith,
	NotStartsWith
}
