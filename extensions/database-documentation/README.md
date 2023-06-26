# Azure Data Studio AI Documentation Generator

The Azure Data Studio AI Documentation Generator is an extension designed to automate the process of generating comprehensive database documentation using artificial intelligence. This tool simplifies the task of creating detailed database diagrams and provides explanations for tables, relationships, and fields within the tables. The resulting documentation is saved in a markdown file format, allowing authorized users to easily access and make edits as needed.

## How it works
Within the Azure Data Studio Object Explorer, right click on either a database, schema, or table. Choose the "View Documentation" option, and wait for you documentation to be generated!

## TO DO
- Language service integration
- Rendering mermaid within markdown preview
- Disallowing user to edit certain parts of documenation; Right now, the extension throws an error if it can't parse it. I'm aiming to make it so that users can edit the documentation text, but not the format

## Features
- Automated Database Documentation: The extension utilizes AI algorithms to automatically generate detailed database documentation, saving significant time and effort.
- Comprehensive Database Diagrams: The tool creates comprehensive and visually appealing diagrams that represent the structure of the database, including tables, relationships, and fields.
- Explanations for Tables, Relationships, and Fields: The generated documentation provides clear explanations for each table, relationship, and field within the database, making it easier for users to understand and navigate.
- Markdown File Format: The documentation is saved in a markdown file format, which is widely supported and allows for easy editing and collaboration among authorized users.
