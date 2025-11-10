# Changelog

All notable changes to the SQL Database Projects extension will be documented in this file.

*The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).*

## [Unreleased]

## [1.5.5] - 2025-11-18

- Adds support for targeting SQL Server 2025 in SQL projects.
- Adds support for Microsoft.Build.Sql 2.0.0
- Adds preview support for publishing SQL projects in VS Code with an enhanced publish dialog.
- Fixed excessive build output by removing the verbosity parameter from the dotnet build command, preventing output from exceeding terminal scroll limits.

## [1.5.4] - 2025-09-11

- Adds support for updating a SQL project from an existing database with 'Update project from database' option.

## [1.5.3] - 2025-06-18

- Adds support for SQL project build as a VS Code task.

## [1.5.2] - 2025-05-19

- Fixed an issue where the menu item for creating a project from an OpenAPI definition was appearing in multiple places.

## [1.5.1] - 2025-04-30

- Fixed an issue where the license for the extension was not being displayed correctly in the marketplace.
- Fixed an issue where projects created from SQL database in Fabric had the target platform incorrectly configured.

## [1.5.0] - 2025-03-31

- Bumped the minimum required version of the .NET SDK to 8.0.0.
- Bumped the axios and @babel/runtime dependencies.
- Fixed download path for Microsoft.Build.Sql binaries to ensure proper installation and compatibility.
- Fixed labels for the container created during deployment of a local development environment with a SQL project.
- Modified the behavior of creating a new SQL project to specify a default SDK version from the extension. [#25797](https://github.com/microsoft/azuredatastudio/issues/25797)
- Updated the label on the `SqlDbFabric` target platform to match the product name "SQL database in Fabric".
- Updated the default Microsoft.Build.Sql version to 1.0.0 for new projects and building original-style projects.

## [1.4.6] - 2025-02-21

- Fixed an issue where the SQL Database Projects extension was not correctly uninstalling in VS Code. [#26215](https://github.com/microsoft/vscode-mssql/issues/18822)

## [1.4.5] - 2024-12-18

- Fixed an issue where the extension in VS Code was not correctly setting the target platform for SQL projects created from existing databases and defaulted to SQL Server 2022 for all projects.
- Updated the default Microsoft.Build.Sql version to 0.2.5-preview for new projects and building original-style projects.
