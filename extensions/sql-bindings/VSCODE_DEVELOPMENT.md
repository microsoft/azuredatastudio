# VS Code Extension Development

For working on the VS Code version of the package follow these steps for local development/testing.

1. Copy the values from [package.vscode.json](./package.vscode.json) into [package.json](./package.json) (overwriting the properties with the same name there)
2. Compile Azure Data Studio as normal and wait for it to finish
3. Run `code <PathToAzureDataStudioSource>/extensions/sql-bindings` from the command line to open a new VS Code instance at the `sql-bindings` folder
4. Run the `Launch Extension in VS Code` launch target from the `Run and Debug` view
5. This should launch an `Extension Development Host` version of VS Code that is running the extension from sources.

If you have the compilation running as watch then once you make changes you can just reload the window to pick up the latest changes being made.
