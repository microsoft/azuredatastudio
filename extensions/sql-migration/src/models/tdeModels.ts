/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum TdeMigrationState {
	Pending = 'Pending',
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export enum TdeDatabaseMigrationState {
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export enum ConfigDialogSetting {
	NoSelection = 'NoSelection',
	ExportCertificates = 'ExportCertificates',
	DoNotExport = 'DoNotExport',
}

export interface TdeMigrationDbState {
	name: string;
	dbState: TdeDatabaseMigrationState;
	message: string;
}

export interface TdeMigrationResult {
	dbList: TdeMigrationDbState[];
	state: TdeMigrationState;
}

export interface TdeMigrationDbResult {
	name: string;
	success: boolean;
	message: string;
}

export interface TdeValidationResult {
	validationTitle: string;
	validationDescription: string;
	validationTroubleshootingTips: string;
	validationErrorMessage: string;
	validationStatus: number;
	validationStatusString: string;
}

export class TdeMigrationModel {

	// Settings for which the user has clicked the apply button
	private _appliedConfigDialogSetting: ConfigDialogSetting;
	private _appliedExportCertUserConsent: boolean;
	private _appliedNetworkPath: string;

	// Settings that are pending but user has not clicked the apply button
	private _pendingConfigDialogSetting: ConfigDialogSetting;
	private _pendingExportCertUserConsent: boolean;
	private _pendingNetworkPath: string;

	// Last network path for which all validations succeeded
	private _lastValidatedNetworkPath: string;

	private _configurationCompleted: boolean;
	private _shownBefore: boolean;
	private _encryptedDbs: string[];
	private _tdeMigrationCompleted: boolean;
	private _tdeMigrationResult: TdeMigrationResult = {
		state: TdeMigrationState.Pending,
		dbList: []
	};

	constructor(
	) {
		this._configurationCompleted = false;
		this._shownBefore = false;
		this._encryptedDbs = [];

		this._appliedConfigDialogSetting = ConfigDialogSetting.NoSelection;
		this._pendingConfigDialogSetting = ConfigDialogSetting.NoSelection;
		this._appliedNetworkPath = '';
		this._pendingNetworkPath = '';
		this._appliedExportCertUserConsent = false;
		this._pendingExportCertUserConsent = false;
		this._tdeMigrationCompleted = false;
		this._lastValidatedNetworkPath = '';

		this._tdeMigrationCompleted = this._tdeMigrationCompleted;
	}

	// If the configuration dialog was shown already.
	public shownBefore(): boolean {
		return this._shownBefore;
	}

	// If the configuration dialog was shown already.
	public configurationShown(): void {
		this._shownBefore = true;
	}

	// The number of encrypted databaes
	public getTdeEnabledDatabasesCount(): number {
		return this._encryptedDbs.length;
	}

	// Whether or not there are tde enabled databases
	public hasTdeEnabledDatabases(): boolean {
		return this.getTdeEnabledDatabasesCount() > 0;
	}

	// The list of encrypted databaes
	public getTdeEnabledDatabases(): string[] {
		return this._encryptedDbs;
	}

	// Sets the databases that are
	public setTdeEnabledDatabasesCount(encryptedDbs: string[]): void {
		this._encryptedDbs = encryptedDbs;
		this._tdeMigrationCompleted = false;	// Reset the migration status when databases change
		this._shownBefore = false;				// Reset the tde dialog showing status when databases change
	}

	// User has clicked "Apply", applies setting
	public applyConfigDialogSetting() {
		if (!this.isAnyChangeReadyToBeApplied()) {
			return;
		}

		this._appliedConfigDialogSetting = this._pendingConfigDialogSetting;
		this._appliedExportCertUserConsent = this._pendingExportCertUserConsent;
		this._appliedNetworkPath = this._pendingNetworkPath;

		if (this._appliedConfigDialogSetting !== ConfigDialogSetting.ExportCertificates) {
			this._appliedExportCertUserConsent = false;
			this._pendingExportCertUserConsent = false;
			this._appliedNetworkPath = "";
			this._pendingNetworkPath = "";
		}

		this._configurationCompleted = true;
	}

	// User has clicked "Cancel", reverts settings to last applied
	public cancelConfigDialogSetting() {
		this._pendingConfigDialogSetting = this._appliedConfigDialogSetting;
		this._pendingExportCertUserConsent = this._appliedExportCertUserConsent;
		this._pendingNetworkPath = this._appliedNetworkPath;
	}

	// Sets the certificate migration method
	public setPendingTdeMigrationMethod(config: ConfigDialogSetting): void {
		this._pendingConfigDialogSetting = config;
		this._tdeMigrationCompleted = false;
	}

	// When ADS is configured to do the certificates migration
	public shouldAdsMigrateCertificates(): boolean {
		return this.hasTdeEnabledDatabases() &&
			this._configurationCompleted &&
			(this.getAppliedConfigDialogSetting() === ConfigDialogSetting.ExportCertificates);
	}

	// Get the value for the lastest tde migration result
	public lastTdeMigrationResult(): TdeMigrationResult {
		return this._tdeMigrationResult;
	}

	// Set the value for the latest tde migration
	public setTdeMigrationResult(result: TdeMigrationResult): void {
		this._tdeMigrationResult = result;
		this._tdeMigrationCompleted = result.state === TdeMigrationState.Succeeded;
	}

	// Reset last tde migration result
	public resetTdeMigrationResult() {
		this._tdeMigrationResult = {
			state: TdeMigrationState.Pending,
			dbList: []
		};
	}

	public isAnyChangeReadyToBeApplied() {
		if (this._pendingConfigDialogSetting === ConfigDialogSetting.NoSelection) {
			return false;
		}

		if (this._pendingConfigDialogSetting === ConfigDialogSetting.ExportCertificates) {
			if (this._pendingNetworkPath !== this._lastValidatedNetworkPath) {
				return false;
			}

			return this._pendingNetworkPath.length > 0 &&
				this._pendingExportCertUserConsent;
		}

		return true;
	}

	public getPendingConfigDialogSetting() {
		return this._pendingConfigDialogSetting;
	}

	public getAppliedConfigDialogSetting() {
		return this._appliedConfigDialogSetting;
	}

	public getPendingNetworkPath() {
		return this._pendingNetworkPath;
	}

	public setPendingNetworkPath(pendingNetworkPath: string) {
		this._pendingNetworkPath = pendingNetworkPath;
	}

	public getAppliedNetworkPath() {
		return this._appliedNetworkPath;
	}

	public getAppliedExportCertUserConsent() {
		return this._appliedExportCertUserConsent;
	}

	public getPendingExportCertUserConsent() {
		return this._pendingExportCertUserConsent;
	}

	public setPendingExportCertUserConsent(pendingExportCertUserConsent: boolean) {
		this._pendingExportCertUserConsent = pendingExportCertUserConsent;
	}

	public setLastValidatedNetworkPath(validatedNetworkPath: string) {
		this._lastValidatedNetworkPath = validatedNetworkPath;
	}

	public getLastValidatedNetworkPath() {
		return this._lastValidatedNetworkPath;
	}
}
