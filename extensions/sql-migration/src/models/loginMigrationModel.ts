/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { MultiStepResult, MultiStepState } from '../dialog/loginMigration/singleLoginStatusDialog';
import * as constants from '../constants/strings';

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
	public _resultsPerStep: Map<mssql.LoginMigrationStep, mssql.StartLoginMigrationResult>;
	public _currentStep: LoginMigrationStep;
	private _logins: Map<string, Login>;
	private _loginMigrationSteps: LoginMigrationStep[];

	constructor() {
		this._resultsPerStep = new Map<mssql.LoginMigrationStep, mssql.StartLoginMigrationResult>();
		this._currentStep = LoginMigrationStep.NotStarted;
		this._logins = new Map<string, Login>();
		this._loginMigrationSteps = [];
		this.SetLoginMigrationSteps();
	}

	public AddLoginMigrationResults(step: LoginMigrationStep, newResult: mssql.StartLoginMigrationResult): void {
		const failingLogins = new Set(Object.keys(newResult.exceptionMap).map(login => login.toLocaleLowerCase()));

		for (const loginName of this._logins.keys()) {
			const status = failingLogins.has(loginName) ? LoginMigrationState.Failed : LoginMigrationState.Succeeded;
			const errors = failingLogins.has(loginName) ? newResult.exceptionMap[loginName] : [];
			this.AddStepStateForLogin(loginName, step, status, errors);
		}

		this._currentStep = step + 1;
	}

	public GetLoginMigrationResults(loginName: string): MultiStepResult[] {
		let loginResults: MultiStepResult[] = [];
		let login = this.GetLogin(loginName);

		for (const step of this._loginMigrationSteps) {
			// The default steps and state will be added if no steps ahve completed
			let stepResult: MultiStepResult = {
				stepName: GetLoginMigrationStepString(step),
				state: MultiStepState.Pending,
				errors: [],
			}

			// If the step has completed, then the login will have status
			if (login?.statusPerStep.has(step)) {
				let stepStatus = login!.statusPerStep.get(step);
				stepResult.state = LoginMigrationStateToMultiStepState[stepStatus!.status];
				stepResult.errors = stepStatus!.errors;
			} else if (step === this._currentStep) {
				stepResult.state = LoginMigrationStateToMultiStepState[LoginMigrationState.Running];
			}

			loginResults.push(stepResult);
		}

		return loginResults;
	}

	public GetLogin(loginName: string) {
		return this._logins.get(loginName.toLocaleLowerCase());
	}

	public AddNewLogins(logins: string[]) {
		logins.forEach(login => this.AddNewLogin(login));
	}

	public AddNewLogin(loginName: string, status: LoginMigrationState = LoginMigrationState.Pending) {
		let newLogin: Login = {
			loginName: loginName,
			overallStatus: status,
			statusPerStep: new Map<LoginMigrationStep, LoginMigrationStepState>(),
		}

		this._logins.set(loginName.toLocaleLowerCase(), newLogin);
	}

	public AddStepStateForLogin(loginName: string, step: LoginMigrationStep, stepStatus: LoginMigrationState, errors: string[] = []) {
		const loginExist = this._logins.has(loginName);

		if (!loginExist) {
			this.AddNewLogin(loginName, LoginMigrationState.Running);
		}

		let login = this.GetLogin(loginName);

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

	public MarkLoginStatus(loginName: string, status: LoginMigrationState) {
		const loginExist = this._logins.has(loginName);

		if (!loginExist) {
			this.AddNewLogin(loginName, LoginMigrationState.Running);
		}

		let login = this.GetLogin(loginName);

		if (login) {
			login.overallStatus = status;
		}
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
}
