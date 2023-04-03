/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';
import { IconPathHelper } from '../constants/iconPathHelper';
import { getSelectedServiceStatus } from '../models/migrationLocalStorage';
import { MenuCommands, SqlMigrationExtensionId } from '../api/utils';
import { DashboardStatusBar } from './DashboardStatusBar';
import { ShowStatusMessageDialog } from '../dialog/generic/genericDialogs';

export const EmptySettingValue = '-';

export enum AdsMigrationStatus {
	ALL = 'all',
	ONGOING = 'ongoing',
	SUCCEEDED = 'succeeded',
	FAILED = 'failed',
	COMPLETING = 'completing'
}

export interface ServiceContextChangeEvent {
	connectionId: string;
}

export interface MigrationDetailsEvent {
	connectionId: string,
	migrationId: string,
	migrationOperationId: string,
}

export abstract class TabBase<T> implements azdata.Tab, vscode.Disposable {
	public content!: azdata.Component;
	public title: string = '';
	public id!: string;
	public icon!: azdata.IconPath | undefined;

	protected context!: vscode.ExtensionContext;
	protected view!: azdata.ModelView;
	protected disposables: vscode.Disposable[] = [];
	protected isRefreshing: boolean = false;
	protected openMigrationsFcn!: (status: AdsMigrationStatus) => Promise<void>;
	protected serviceContextChangedEvent!: vscode.EventEmitter<ServiceContextChangeEvent>;
	protected statusBar!: DashboardStatusBar;

	protected abstract initialize(view: azdata.ModelView): Promise<void>;

	public abstract refresh(initialize?: boolean): Promise<void>;

	dispose() {
		this.disposables.forEach(
			d => { try { d.dispose(); } catch { } });
	}

	protected numberCompare(number1: number | undefined, number2: number | undefined, sortDir: number): number {
		if (!number1) {
			return sortDir;
		} else if (!number2) {
			return -sortDir;
		}
		return number1 > number2 ? -sortDir : sortDir;
	}

	protected stringCompare(string1: string | undefined, string2: string | undefined, sortDir: number): number {
		if (!string1) {
			return sortDir;
		} else if (!string2) {
			return -sortDir;
		}
		return string1.localeCompare(string2) * -sortDir;
	}

	protected dateCompare(stringDate1: string | undefined, stringDate2: string | undefined, sortDir: number): number {
		if (!stringDate1) {
			return sortDir;
		} else if (!stringDate2) {
			return -sortDir;
		}
		return new Date(stringDate1) > new Date(stringDate2) ? -sortDir : sortDir;
	}

	protected async updateServiceContext(button: azdata.ButtonComponent): Promise<void> {
		const label = await getSelectedServiceStatus();
		if (button.label !== label ||
			button.title !== label) {

			button.label = label;
			button.title = label;

			await this.refresh();
		}
	}

	protected createNewLoginMigrationButton(): azdata.ButtonComponent {
		const newLoginMigrationButton = this.view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: loc.DESKTOP_LOGIN_MIGRATION_BUTTON_LABEL,
				description: loc.DESKTOP_LOGIN_MIGRATION_BUTTON_DESCRIPTION,
				height: 24,
				iconHeight: 24,
				iconWidth: 24,
				iconPath: IconPathHelper.addNew,
			}).component();
		this.disposables.push(
			newLoginMigrationButton.onDidClick(async () => {
				const actionId = MenuCommands.StartLoginMigration;
				const args = {
					extensionId: SqlMigrationExtensionId,
					issueTitle: loc.DASHBOARD_LOGIN_MIGRATE_TASK_BUTTON_TITLE,
				};
				return await vscode.commands.executeCommand(actionId, args);
			}));
		return newLoginMigrationButton;
	}

	protected createNewMigrationButton(): azdata.ButtonComponent {
		const newMigrationButton = this.view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: loc.DESKTOP_MIGRATION_BUTTON_LABEL,
				description: loc.DESKTOP_MIGRATION_BUTTON_DESCRIPTION,
				height: 24,
				iconHeight: 24,
				iconWidth: 24,
				iconPath: IconPathHelper.addNew,
			}).component();
		this.disposables.push(
			newMigrationButton.onDidClick(async () => {
				const actionId = MenuCommands.StartMigration;
				const args = {
					extensionId: SqlMigrationExtensionId,
					issueTitle: loc.DASHBOARD_MIGRATE_TASK_BUTTON_TITLE,
				};
				return await vscode.commands.executeCommand(actionId, args);
			}));
		return newMigrationButton;
	}

	protected createNewSupportRequestButton(): azdata.ButtonComponent {
		const newSupportRequestButton = this.view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: loc.DESKTOP_SUPPORT_BUTTON_LABEL,
				description: loc.DESKTOP_SUPPORT_BUTTON_DESCRIPTION,
				height: 24,
				iconHeight: 24,
				iconWidth: 24,
				iconPath: IconPathHelper.newSupportRequest,
			}).component();
		this.disposables.push(
			newSupportRequestButton.onDidClick(async () => {
				await vscode.env.openExternal(vscode.Uri.parse(
					`https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest`));
			}));
		return newSupportRequestButton;
	}

	protected createFeedbackButton(): azdata.ButtonComponent {
		const feedbackButton = this.view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: loc.DESKTOP_FEEDBACK_BUTTON_LABEL,
				description: loc.DESKTOP_FEEDBACK_BUTTON_DESCRIPTION,
				height: 24,
				iconHeight: 24,
				iconWidth: 24,
				iconPath: IconPathHelper.sendFeedback,
			}).component();
		this.disposables.push(
			feedbackButton.onDidClick(async () => {
				const actionId = MenuCommands.IssueReporter;
				const args = {
					extensionId: SqlMigrationExtensionId,
					issueTitle: loc.FEEDBACK_ISSUE_TITLE,
				};
				return await vscode.commands.executeCommand(actionId, args);
			}));
		return feedbackButton;
	}

	protected showDialogMessage(
		title: string,
		statusMessage: string,
		errorMessage: string,
	): void {
		ShowStatusMessageDialog(title, statusMessage, errorMessage);
	}
}
