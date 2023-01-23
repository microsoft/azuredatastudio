/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { MultiStepResult, MultiStepState } from '../dialog/generic/multiStepStatusDialog';
import * as constants from '../constants/strings';
import { LoginTableInfo } from '../api/sqlUtils';

type ExceptionMap = { [login: string]: any }

export enum LoginMigrationStep {
	NotStarted = -1,
	MigrateLogins = 0,
	EstablishUserMapping = 1,
	MigrateServerRolesAndSetPermissions = 2,
	MigrationCompleted = 3,
}

export function GetLoginMigrationStepString(step: LoginMigrationStep): string {
	switch (step) {
		case LoginMigrationStep.NotStarted:
			return constants.NOT_STARTED;
		case LoginMigrationStep.MigrateLogins:
			return constants.MIGRATE_LOGINS;
		case LoginMigrationStep.EstablishUserMapping:
			return constants.ESTABLISH_USER_MAPPINGS;
		case LoginMigrationStep.MigrateServerRolesAndSetPermissions:
			return constants.MIGRATE_SERVER_ROLES_AND_SET_PERMISSIONS;
		case LoginMigrationStep.MigrationCompleted:
			return constants.LOGIN_MIGRATION_COMPLETED;
		default:
			return ""
	}
}

export enum LoginMigrationState {
	Pending = 'Pending',
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export const LoginMigrationStateToMultiStepState: constants.LookupTable<MultiStepState> = {
	[LoginMigrationState.Pending]: MultiStepState.Pending,
	[LoginMigrationState.Running]: MultiStepState.Running,
	[LoginMigrationState.Succeeded]: MultiStepState.Succeeded,
	[LoginMigrationState.Failed]: MultiStepState.Failed,
	[LoginMigrationState.Canceled]: MultiStepState.Canceled,
	default: MultiStepState.Pending
};


export interface LoginMigrationStepState {
	loginName: string;
	stepName: LoginMigrationStep;
	status: LoginMigrationState;
	errors: string[];
}

export interface Login {
	loginName: string;
	overallStatus: LoginMigrationState;
	statusPerStep: Map<LoginMigrationStep, LoginMigrationStepState>;
}

export class LoginMigrationModel {
	public resultsPerStep: Map<mssql.LoginMigrationStep, mssql.StartLoginMigrationResult>;
	public collectedSourceLogins: boolean = false;
	public collectedTargetLogins: boolean = false;;
	public loginsOnSource: LoginTableInfo[] = [];
	public loginsOnTarget: string[] = [];
	private _currentStepIdx: number = 0;;
	private _logins: Map<string, Login>;
	private _loginMigrationSteps: LoginMigrationStep[] = [];

	constructor() {
		this.resultsPerStep = new Map<mssql.LoginMigrationStep, mssql.StartLoginMigrationResult>();
		this._logins = new Map<string, Login>();
		this.SetLoginMigrationSteps();
	}

	public get currentStep(): LoginMigrationStep {
		return this._currentStepIdx >= this._loginMigrationSteps.length ? LoginMigrationStep.MigrationCompleted : this._loginMigrationSteps[this._currentStepIdx];
	}

	public get isMigrationComplete(): boolean {
		return this._currentStepIdx === this._loginMigrationSteps.length;
	}

	public AddLoginMigrationResults(step: LoginMigrationStep, newResult: mssql.StartLoginMigrationResult): void {
		const exceptionMap = this._getExceptionMapWithNormalizedKeys(newResult.exceptionMap);
		this._currentStepIdx = this._loginMigrationSteps.findIndex(s => s === step) + 1;

		for (const loginName of this._logins.keys()) {
			const status = loginName in exceptionMap ? LoginMigrationState.Failed : LoginMigrationState.Succeeded;
			let errors = loginName in exceptionMap ? this._extractErrors(exceptionMap, loginName) : [];
			this._addStepStateForLogin(loginName, step, status, errors);

			if (this.isMigrationComplete) {
				const loginStatus = this._didAnyStepFail(loginName) ? LoginMigrationState.Failed : LoginMigrationState.Succeeded;
				this._markLoginStatus(loginName, loginStatus);
			}
		}
	}

	public ReportException(step: LoginMigrationStep, error: any): void {
		this._currentStepIdx = this._loginMigrationSteps.findIndex(s => s === step) + 1;

		for (const loginName of this._logins.keys()) {
			// Mark current step as failed with the error message and mark remaining messages as canceled
			let errors = [error.message];
			this._addStepStateForLogin(loginName, step, LoginMigrationState.Failed, errors);
			this._markRemainingSteps(loginName, LoginMigrationState.Canceled);
			this._markLoginStatus(loginName, LoginMigrationState.Failed);
		}

		this._markMigrationComplete();
	}

	public GetLoginMigrationResults(loginName: string): MultiStepResult[] {
		let loginResults: MultiStepResult[] = [];
		let login = this._getLogin(loginName);

		for (const step of this._loginMigrationSteps) {
			// The default steps and state will be added if no steps have completed
			let stepResult: MultiStepResult = {
				stepName: GetLoginMigrationStepString(step),
				state: MultiStepState.Pending,
				errors: [],
			}

			// If the step has completed, then the login will have the stored status
			if (login?.statusPerStep.has(step)) {
				let stepStatus = login!.statusPerStep.get(step);
				stepResult.state = LoginMigrationStateToMultiStepState[stepStatus!.status];
				stepResult.errors = stepStatus!.errors;
			} else if (step === this.currentStep) {
				stepResult.state = LoginMigrationStateToMultiStepState[LoginMigrationState.Running];
			}

			loginResults.push(stepResult);
		}

		return loginResults;
	}

	public AddNewLogins(logins: string[]) {
		logins.forEach(login => this._addNewLogin(login));
	}

	public SetLoginMigrationSteps(steps: LoginMigrationStep[] = []) {
		this._loginMigrationSteps = [];

		if (steps.length === 0) {
			this._loginMigrationSteps.push(LoginMigrationStep.MigrateLogins);
			this._loginMigrationSteps.push(LoginMigrationStep.EstablishUserMapping);
			this._loginMigrationSteps.push(LoginMigrationStep.MigrateServerRolesAndSetPermissions);
		} else {
			this._loginMigrationSteps = steps;
		}
	}


	private _getLogin(loginName: string) {
		return this._logins.get(loginName.toLocaleLowerCase());
	}

	private _addNewLogin(loginName: string, status: LoginMigrationState = LoginMigrationState.Pending) {
		let newLogin: Login = {
			loginName: loginName,
			overallStatus: status,
			statusPerStep: new Map<LoginMigrationStep, LoginMigrationStepState>(),
		}

		this._logins.set(loginName.toLocaleLowerCase(), newLogin);
	}

	private _addStepStateForLogin(loginName: string, step: LoginMigrationStep, stepStatus: LoginMigrationState, errors: string[] = []) {
		const loginExist = this._logins.has(loginName);

		if (!loginExist) {
			this._addNewLogin(loginName, LoginMigrationState.Running);
		}

		let login = this._getLogin(loginName);

		if (login) {
			login.overallStatus = LoginMigrationState.Running;
			login.statusPerStep.set(
				step,
				{
					loginName: loginName,
					stepName: step,
					status: stepStatus,
					errors: errors
				}
			);
		}
	}

	private _markLoginStatus(loginName: string, status: LoginMigrationState) {
		const loginExist = this._logins.has(loginName);

		if (!loginExist) {
			this._addNewLogin(loginName, LoginMigrationState.Running);
		}

		let login = this._getLogin(loginName);

		if (login) {
			login.overallStatus = status;
		}
	}

	private _didAnyStepFail(loginName: string) {
		const login = this._getLogin(loginName);
		if (login) {
			return Object.values(login.statusPerStep).every(status => status === LoginMigrationState.Failed);
		}

		return false;
	}

	private _getExceptionMapWithNormalizedKeys(exceptionMap: ExceptionMap): ExceptionMap {
		return Object.keys(exceptionMap).reduce((result: ExceptionMap, key: string) => {
			result[key.toLocaleLowerCase()] = exceptionMap[key];
			return result;
		}, {});
	}

	private _extractErrors(exceptionMap: ExceptionMap, loginName: string): string[] {
		return exceptionMap[loginName].map((exception: any) => typeof exception.InnerException !== 'undefined' && exception.InnerException !== null ? exception.InnerException.Message : exception.Message);
	}

	private _markMigrationComplete() {
		this._currentStepIdx = this._loginMigrationSteps.length;
	}

	private _markRemainingSteps(loginName: string, status: LoginMigrationState) {
		for (let i = this._currentStepIdx; i < this._loginMigrationSteps.length; i++) {
			this._addStepStateForLogin(loginName, this._loginMigrationSteps[i], status, []);
		}
	}
}
