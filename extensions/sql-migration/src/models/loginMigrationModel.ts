/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MultiStepResult, MultiStepState } from '../dialog/generic/multiStepStatusDialog';
import * as constants from '../constants/strings';
import { getSourceConnectionString, getTargetConnectionString, LoginTableInfo } from '../api/sqlUtils';
import { MigrationStateModel } from './stateMachine';
import { logError, TelemetryViews } from '../telemetry';
import * as contracts from '../service/contracts';

type ExceptionMap = { [login: string]: any }

export enum LoginType {
	Windows_Login = 'windows_login',
	SQL_Login = 'sql_login',
	Mixed_Mode = 'mixed_mode',
}

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
			return "";
	}
}

export interface LoginMigrationStepState {
	loginName: string;
	stepName: LoginMigrationStep;
	status: MultiStepState;
	errors: string[];
}

export interface Login {
	loginName: string;
	overallStatus: MultiStepState;
	statusPerStep: Map<LoginMigrationStep, LoginMigrationStepState>;
}

export class LoginMigrationModel {
	public resultsPerStep: Map<contracts.LoginMigrationStep, contracts.StartLoginMigrationResult>;
	public collectedSourceLogins: boolean = false;
	public collectedTargetLogins: boolean = false;;
	public loginsOnSource: LoginTableInfo[] = [];
	public loginsOnTarget: string[] = [];
	public loginMigrationsResult!: contracts.StartLoginMigrationResult;
	public loginMigrationsError: any;
	public loginsForMigration!: LoginTableInfo[];
	public errorCountMap: Map<string, any> = new Map<string, any>();
	public durationPerStep: Map<string, string> = new Map<string, string>();
	private _currentStepIdx: number = 0;
	private _logins: Map<string, Login>;
	private _loginMigrationSteps: LoginMigrationStep[] = [];

	constructor() {
		this.resultsPerStep = new Map<contracts.LoginMigrationStep, contracts.StartLoginMigrationResult>();
		this._logins = new Map<string, Login>();
		this.setLoginMigrationSteps();
	}

	public get currentStep(): LoginMigrationStep {
		return this._currentStepIdx >= this._loginMigrationSteps.length ? LoginMigrationStep.MigrationCompleted : this._loginMigrationSteps[this._currentStepIdx];
	}

	public get isMigrationComplete(): boolean {
		return this._currentStepIdx === this._loginMigrationSteps.length;
	}

	public get selectedWindowsLogins(): boolean {
		return this.loginsForMigration.some(logins => logins.loginType.toLocaleLowerCase() === LoginType.Windows_Login);
	}

	public get selectedAllWindowsLogins(): boolean {
		return this.loginsForMigration.every(logins => logins.loginType.toLocaleLowerCase() === LoginType.Windows_Login);
	}

	public get selectedAllSQLLogins(): boolean {
		return this.loginsForMigration.every(logins => logins.loginType.toLocaleLowerCase() === LoginType.SQL_Login);
	}

	public get loginsAuthType(): LoginType {
		if (this.selectedAllWindowsLogins) {
			return LoginType.Windows_Login;
		} else if (this.selectedAllSQLLogins) {
			return LoginType.SQL_Login;
		}

		return LoginType.Mixed_Mode;
	}

	public get hasSystemError(): boolean {
		return this.loginMigrationsError ? true : false;
	}

	public async MigrateLogins(stateMachine: MigrationStateModel): Promise<boolean> {
		this.addNewLogins(stateMachine._loginMigrationModel.loginsForMigration.map(row => row.loginName));
		return await this.runLoginMigrationStep(LoginMigrationStep.MigrateLogins, stateMachine);

		// TODO AKMA : emit telemetry
	}

	public async EstablishUserMappings(stateMachine: MigrationStateModel): Promise<boolean> {
		return await this.runLoginMigrationStep(LoginMigrationStep.EstablishUserMapping, stateMachine);

		// TODO AKMA : emit telemetry
	}

	public async MigrateServerRolesAndSetPermissions(stateMachine: MigrationStateModel): Promise<boolean> {
		return await this.runLoginMigrationStep(LoginMigrationStep.MigrateServerRolesAndSetPermissions, stateMachine);

		// TODO AKMA : emit telemetry
	}


	public GetDisplayResults(loginName: string): MultiStepResult[] {
		let loginResults: MultiStepResult[] = [];
		let login = this.getLogin(loginName);

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
				stepResult.state = stepStatus!.status;
				stepResult.errors = stepStatus!.errors;
			} else if (step === this.currentStep) {
				stepResult.state = MultiStepState.Running;
			}

			loginResults.push(stepResult);
		}

		return loginResults;
	}

	private setErrorCountMapPerStep(step: LoginMigrationStep, result: contracts.StartLoginMigrationResult) {
		const errorCount = result.exceptionMap ? Object.keys(result.exceptionMap).length : 0;
		this.errorCountMap.set(LoginMigrationStep[step], errorCount);
	}

	private setDurationPerStep(step: LoginMigrationStep, result: contracts.StartLoginMigrationResult) {
		this.durationPerStep.set(LoginMigrationStep[step], result.elapsedTime);
	}

	private setLoginMigrationSteps(steps: LoginMigrationStep[] = []) {
		this._loginMigrationSteps = [];

		if (steps.length === 0) {
			this._loginMigrationSteps.push(LoginMigrationStep.MigrateLogins);
			this._loginMigrationSteps.push(LoginMigrationStep.EstablishUserMapping);
			this._loginMigrationSteps.push(LoginMigrationStep.MigrateServerRolesAndSetPermissions);
		} else {
			this._loginMigrationSteps = steps;
		}
	}

	private addNewLogins(logins: string[]) {
		logins.forEach(login => this.addNewLogin(login));
	}

	public addLoginMigrationResults(step: LoginMigrationStep, newResult: contracts.StartLoginMigrationResult): void {
		const exceptionMap = this.getExceptionMapWithNormalizedKeys(newResult.exceptionMap);
		this._currentStepIdx = this._loginMigrationSteps.findIndex(s => s === step) + 1;

		for (const loginName of this._logins.keys()) {
			const status = loginName in exceptionMap ? MultiStepState.Failed : MultiStepState.Succeeded;
			const errors = loginName in exceptionMap ? this.extractErrors(exceptionMap, loginName) : [];
			this.addStepStateForLogin(loginName, step, status, errors);

			if (this.isMigrationComplete) {
				const loginStatus = this.didAnyStepFail(loginName) ? MultiStepState.Failed : MultiStepState.Succeeded;
				this.markLoginStatus(loginName, loginStatus);
			}
		}

		this.updateLoginMigrationResults(newResult);
		this.setErrorCountMapPerStep(step, newResult);
		this.setDurationPerStep(step, newResult);
	}

	private updateLoginMigrationResults(newResult: contracts.StartLoginMigrationResult): void {
		if (this.loginMigrationsResult && this.loginMigrationsResult.exceptionMap) {
			for (var key in newResult.exceptionMap) {
				this.loginMigrationsResult.exceptionMap[key] = [...this.loginMigrationsResult.exceptionMap[key] || [], newResult.exceptionMap[key]]
			}
		} else {
			this.loginMigrationsResult = newResult;
		}
	}

	public reportException(step: LoginMigrationStep, error: any): void {
		this._currentStepIdx = this._loginMigrationSteps.findIndex(s => s === step) + 1;

		for (const loginName of this._logins.keys()) {
			// Mark current step as failed with the error message and mark remaining messages as canceled
			let errors = [error.message];
			this.addStepStateForLogin(loginName, step, MultiStepState.Failed, errors);
			this.markRemainingSteps(loginName, MultiStepState.Canceled);
			this.markLoginStatus(loginName, MultiStepState.Failed);
		}

		this.markMigrationComplete();
	}

	private async runMigrateLoginsTask(sourceConnStr: string, targetConnStr: string, stateMachine: MigrationStateModel): Promise<boolean> {
		try {
			var response = (await stateMachine.migrationService.migrateLogins(
				sourceConnStr,
				targetConnStr,
				stateMachine._loginMigrationModel.loginsForMigration.map(row => row.loginName),
				stateMachine._aadDomainName
			))!;

			this.addLoginMigrationResults(LoginMigrationStep.MigrateLogins, response);
			return true;

		} catch (error) {
			logError(TelemetryViews.LoginMigrationWizard, 'MigratinLoginsFailed', error);
			this.reportException(LoginMigrationStep.MigrateLogins, error);
			this.loginMigrationsError = error;
			return false;
		}
	}

	private async runEstablishUserMappingTask(sourceConnStr: string, targetConnStr: string, stateMachine: MigrationStateModel): Promise<boolean> {
		try {
			var response = (await stateMachine.migrationService.establishUserMapping(
				sourceConnStr,
				targetConnStr,
				stateMachine._loginMigrationModel.loginsForMigration.map(row => row.loginName),
				stateMachine._aadDomainName
			))!;

			this.addLoginMigrationResults(LoginMigrationStep.EstablishUserMapping, response);
			return true;

		} catch (error) {
			logError(TelemetryViews.LoginMigrationWizard, 'EstablishingUserMappingFailed', error);
			this.reportException(LoginMigrationStep.EstablishUserMapping, error);
			this.loginMigrationsError = error;
			return false;
		}
	}

	private async runMigrateServerRolesAndSetPermissionsTask(sourceConnStr: string, targetConnStr: string, stateMachine: MigrationStateModel): Promise<boolean> {
		try {
			var response = (await stateMachine.migrationService.migrateServerRolesAndSetPermissions(
				sourceConnStr,
				targetConnStr,
				stateMachine._loginMigrationModel.loginsForMigration.map(row => row.loginName),
				stateMachine._aadDomainName
			))!;

			this.addLoginMigrationResults(LoginMigrationStep.MigrateServerRolesAndSetPermissions, response);
			return true;

		} catch (error) {
			logError(TelemetryViews.LoginMigrationWizard, 'MigratingServerRolesAndSettingPermissionsFailed', error);
			this.reportException(LoginMigrationStep.MigrateServerRolesAndSetPermissions, error);
			this.loginMigrationsError = error;
			return false;
		}
	}

	private async runLoginMigrationStep(step: LoginMigrationStep, stateMachine: MigrationStateModel): Promise<boolean> {
		const sourceConnectionString = await getSourceConnectionString();
		const targetConnectionString = await getTargetConnectionString(
			stateMachine.targetServerName,
			stateMachine._targetServerInstance.id,
			stateMachine._targetUserName,
			stateMachine._targetPassword,
			// for login migration, connect to target Azure SQL with true/true
			// to-do: take as input from the user, should be true/false for DB/MI but true/true for VM
			true /* encryptConnection */,
			true /* trustServerCertificate */);

		// Get telemtry values
		switch (step) {
			case LoginMigrationStep.MigrateLogins:
				return await this.runMigrateLoginsTask(sourceConnectionString, targetConnectionString, stateMachine);
			case LoginMigrationStep.EstablishUserMapping:
				return await this.runEstablishUserMappingTask(sourceConnectionString, targetConnectionString, stateMachine);
			case LoginMigrationStep.MigrateServerRolesAndSetPermissions:
				return await this.runMigrateServerRolesAndSetPermissionsTask(sourceConnectionString, targetConnectionString, stateMachine);
		}

		return false;
	}

	private getLogin(loginName: string) {
		return this._logins.get(loginName.toLocaleLowerCase());
	}

	private addNewLogin(loginName: string, status: MultiStepState = MultiStepState.Pending) {
		let newLogin: Login = {
			loginName: loginName,
			overallStatus: status,
			statusPerStep: new Map<LoginMigrationStep, LoginMigrationStepState>(),
		}

		this._logins.set(loginName.toLocaleLowerCase(), newLogin);
	}

	private addStepStateForLogin(loginName: string, step: LoginMigrationStep, stepStatus: MultiStepState, errors: string[] = []) {
		const loginExist = this._logins.has(loginName);

		if (!loginExist) {
			this.addNewLogin(loginName, MultiStepState.Running);
		}

		const login = this.getLogin(loginName);

		if (login) {
			login.overallStatus = MultiStepState.Running;
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

	private markLoginStatus(loginName: string, status: MultiStepState) {
		const loginExist = this._logins.has(loginName);

		if (!loginExist) {
			this.addNewLogin(loginName, MultiStepState.Running);
		}

		let login = this.getLogin(loginName);

		if (login) {
			login.overallStatus = status;
		}
	}

	private didAnyStepFail(loginName: string) {
		const login = this.getLogin(loginName);
		if (login) {
			return Object.values(login.statusPerStep).every(status => status === MultiStepState.Failed);
		}

		return false;
	}

	private getExceptionMapWithNormalizedKeys(exceptionMap: ExceptionMap): ExceptionMap {
		return Object.keys(exceptionMap).reduce((result: ExceptionMap, key: string) => {
			result[key.toLocaleLowerCase()] = exceptionMap[key];
			return result;
		}, {});
	}

	private extractErrors(exceptionMap: ExceptionMap, loginName: string): string[] {
		return exceptionMap[loginName].map((exception: any) => typeof exception.InnerException !== 'undefined'
			&& exception.InnerException !== null ? exception.InnerException.Message : exception.Message);
	}

	private markMigrationComplete() {
		this._currentStepIdx = this._loginMigrationSteps.length;
	}

	private markRemainingSteps(loginName: string, status: MultiStepState) {
		for (let i = this._currentStepIdx; i < this._loginMigrationSteps.length; i++) {
			this.addStepStateForLogin(loginName, this._loginMigrationSteps[i], status, []);
		}
	}
}
