import Bootstrapper from './bootstrapper';
import CommandFactory from './command-factory';
import WorkspaceAdaptor from './adaptors/workspace';
import ContentProvider from './content-provider';
import NormalisationRuleStore from './normalisation-rule-store';
import SelectionInfoRegistry from './selection-info-registry';
import * as vscode from 'vscode';
import CommandAdaptor from './adaptors/command';
import WindowAdaptor from './adaptors/window';
import Clipboard from './adaptors/clipboard';
// import * as clipboardy from 'clipboardy';
import {NullVsTelemetryReporter, VsTelemetryReporterCreator} from './telemetry-reporter';
import VsTelemetryReporter from 'vscode-extension-telemetry';

export default class BootstrapperFactory {
    private workspaceAdaptor?: WorkspaceAdaptor;

    create() {
        const logger = console;
        const selectionInfoRegistry = new SelectionInfoRegistry();
        const workspaceAdaptor = this.getWorkspaceAdaptor();
        const commandAdaptor = new CommandAdaptor(vscode.commands, vscode.Uri.parse, logger);
        const normalisationRuleStore = new NormalisationRuleStore(workspaceAdaptor);
        const commandFactory = new CommandFactory(
            selectionInfoRegistry,
            normalisationRuleStore,
            commandAdaptor,
            new WindowAdaptor(vscode.window),
            new Clipboard(null, process.platform),
            () => new Date()
        );
        const contentProvider = new ContentProvider(selectionInfoRegistry, normalisationRuleStore);
        return new Bootstrapper(commandFactory, contentProvider, workspaceAdaptor, commandAdaptor);
    }

    private getWorkspaceAdaptor() {
        this.workspaceAdaptor = this.workspaceAdaptor || new WorkspaceAdaptor(vscode.workspace);
        return this.workspaceAdaptor;
    }

    getVsTelemetryReporterCreator(): VsTelemetryReporterCreator {
        const enableTelemetry = this.getWorkspaceAdaptor().get<boolean>('enableTelemetry');
        if (enableTelemetry) {
            return (id: string, version: string, telemetryKey: string) =>
                new VsTelemetryReporter(id, version, telemetryKey);
        } else {
            return () => new NullVsTelemetryReporter();
        }
    }
}
