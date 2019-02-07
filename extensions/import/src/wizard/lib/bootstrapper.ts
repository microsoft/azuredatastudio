import CommandFactory from './command-factory';
import ContentProvider from './content-provider';
import {EXTENSION_NAMESPACE, EXTENSION_SCHEME} from './const';
import {ExecutionContextLike} from './types/vscode';
import WorkspaceAdaptor from './adaptors/workspace';
import CommandAdaptor, {CommandItem} from './adaptors/command';

export default class Bootstrapper {
    private readonly commandFactory: CommandFactory;
    private readonly contentProvider: ContentProvider;
    private readonly workspaceAdaptor: WorkspaceAdaptor;
    private readonly commandAdaptor: CommandAdaptor;

    constructor(commandFactory: CommandFactory,
                contentProvider: ContentProvider,
                workspaceAdaptor: WorkspaceAdaptor,
                commandAdaptor: CommandAdaptor) {
        this.commandFactory = commandFactory;
        this.contentProvider = contentProvider;
        this.workspaceAdaptor = workspaceAdaptor;
        this.commandAdaptor = commandAdaptor;
    }

    initiate(context: ExecutionContextLike) {
        this.registerProviders(context);
        this.registerCommands(context);
    }

    private registerProviders(context: ExecutionContextLike) {
        const disposable = this.workspaceAdaptor.registerTextDocumentContentProvider(
            EXTENSION_SCHEME,
            this.contentProvider
        );
        context.subscriptions.push(disposable);
    }

    private registerCommands(context: ExecutionContextLike) {
        this.commandList.forEach(cmd => {
            const disposable = this.commandAdaptor.registerCommand(cmd);
            context.subscriptions.push(disposable);
        });
    }

    private get commandList(): CommandItem[] {
        return [
            {
                name: `${EXTENSION_NAMESPACE}.diffVisibleEditors`,
                type: 'GENERAL',
                command: this.commandFactory.createCompareVisibleEditorsCommand()
            },
            {
                name: `${EXTENSION_NAMESPACE}.markSection1`,
                type: 'TEXT_EDITOR',
                command: this.commandFactory.crateSaveText1Command()
            },
            {
                name: `${EXTENSION_NAMESPACE}.markSection2AndTakeDiff`,
                type: 'TEXT_EDITOR',
                command: this.commandFactory.createCompareSelectionWithText1Command()
            },
            {
                name: `${EXTENSION_NAMESPACE}.diffSelectionWithClipboard`,
                type: 'TEXT_EDITOR',
                command: this.commandFactory.createCompareSelectionWithClipboardCommand()
            },
            {
                name: `${EXTENSION_NAMESPACE}.togglePreComparisonTextNormalizationRules`,
                type: 'GENERAL',
                command: this.commandFactory.createToggleNormalisationRulesCommand()
            }
        ];
    }
}
