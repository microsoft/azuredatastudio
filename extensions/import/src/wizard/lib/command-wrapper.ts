import {Command} from './commands/command';
import {Logger} from './types/logger';
import * as vscode from 'vscode';
import TextEditor from './adaptors/text-editor';
import {TelemetryReporterLocator} from './telemetry-reporter';
import {TelemetryReporter} from './telemetry-reporter';

export default class CommandWrapper {
    private readonly name: string;
    private readonly command: Command;
    private readonly telemetryReporter: TelemetryReporter;
    private readonly logger: Logger;

    constructor(name: string, command: Command, logger: Logger) {
        this.name = name;
        this.command = command;
        this.telemetryReporter = TelemetryReporterLocator.getReporter();
        this.logger = logger;
    }

    async execute(editor?: vscode.TextEditor) {
        try {
            this.telemetryReporter.logCommandTrigger(this.name);
            return await this.command.execute(editor && new TextEditor(editor));
        } catch (e) {
            this.handleError(e);
        }
    }

    private handleError(e: Error) {
        this.telemetryReporter.logCommandErrored(this.name);
        this.logger.error(e.stack);
    }
}
