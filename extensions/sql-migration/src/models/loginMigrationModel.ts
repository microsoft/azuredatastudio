/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { MultiStepResult, MultiStepState } from '../dialog/loginMigration/singleLoginStatusDialog';

// import { LoginTableInfo } from '../api/sqlUtils';

export enum LoginMigrationStep {
	ValidateLogins = 0,
	MigrateLogins = 1,
	EstablishUserMapping = 2,
	MigrateServerRoles = 3,
	EstablishServerRoleMapping = 4,
	SetLoginPermissions = 5,
	SetServerRolePermissions = 6,
	MigrationCompleted = 7,
}

export class LoginMigrationModel {
	// public _loginsForMigration!: LoginTableInfo[];
	// public _aadDomainName!: string;
	// public _loginMigrationsResult!: mssql.StartLoginMigrationResult;
	// public _loginMigrationsError: any;
	public _resultsPerStep: Map<mssql.LoginMigrationStep, mssql.StartLoginMigrationResult>;
	public _currentStep: LoginMigrationStep;

	constructor() {
		this._resultsPerStep = new Map<mssql.LoginMigrationStep, mssql.StartLoginMigrationResult>();
		this._currentStep = LoginMigrationStep.ValidateLogins;
	}

	public AddLoginMigrationResults(step: LoginMigrationStep, newResult: mssql.StartLoginMigrationResult): void {
		this._currentStep = step + 1;
		// if (!this._resultsPerStep.has(step) || !this._resultsPerStep.get(step)) {
		// 	this._resultsPerStep.set(step, newResult);
		// 	return;
		// }
		// const result = this._resultsPerStep.get(step);
		// if (result?.exceptionMap) {
		// 	for (var key in newResult.exceptionMap) {
		// 		result.exceptionMap[key] = [...result.exceptionMap[key] || [], newResult.exceptionMap[key]]
		// 	}
		// }
	}

	private enumToStr(enumeration: any, value: any): string {
		for (var k in enumeration)
			if (enumeration[k] === value)
				return <string>k;
		return "";
	}

	public GetLoginMigrationResults(loginName: string): MultiStepResult[] {
		let loginResults: MultiStepResult[] = [];

		for (let item in LoginMigrationStep) {
			if (!isNaN(Number(item)) && Number(item) < this._currentStep) {
				let result = { errors: [this.enumToStr(LoginMigrationStep, item)], state: MultiStepState.Succeeded };
				loginResults.push(result);
			}
			else {
				let result = { errors: [item.toString()], state: MultiStepState.Pending };
				loginResults.push(result);
			}
		}

		return loginResults;
	}
}
