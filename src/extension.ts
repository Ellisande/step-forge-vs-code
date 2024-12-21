// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { DefinitionProvider } from './providers/definitionProvider';
import { StepParser } from './parsers/stepParser';
import { GherkinParser } from './parsers/gherkinParser';
import { CompletionProvider } from './providers/completionProvider';
import { StepStateDiagnosticsProvider } from './providers/stepStateDiagnosticsProvider';
import { StepDefinitionDiagnosticsProvider } from './providers/stepDefinitionDiagnosticsProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Extension is activating...');

  // Add activation logging
  const workspaceFolders = vscode.workspace.workspaceFolders;
  console.log('Current workspace:', workspaceFolders);
  if (!workspaceFolders) {
    console.log('No workspace folders found');
    return;
  }

  // Initialize parsers
  const stepParser = new StepParser();
  const gherkinParser = new GherkinParser();

  // Initial parsing of existing files with error handling
  console.log('Starting initial file parsing...');
  try {
    await stepParser.parseStepFiles('**/features/**/*.ts');
    console.log('Successfully parsed all TypeScript files');
  } catch (error) {
    console.error('Error parsing files:', error);
  }

  // Watch for TypeScript file changes
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/features/**/*.ts',
    false, // Don't ignore creates
    false, // Don't ignore changes
    false, // Don't ignore deletes
  );

  // Enhanced file watcher event handlers with logging
  watcher.onDidChange(async (uri) => {
    console.log(`TypeScript file changed: ${uri.fsPath}`);
    try {
      await stepParser.parseStepFiles(uri.fsPath);
      console.log(`Successfully parsed changed file: ${uri.fsPath}`);

      // Re-run diagnostics on all feature files after step file changes
      const featureFiles = await vscode.workspace.findFiles('**/*.feature');
      for (const file of featureFiles) {
        const document = await vscode.workspace.openTextDocument(file);
        await diagnosticsProvider.provideDiagnostics(document);
        await stepStateDiagnosticsProvider.provideDiagnostics(document);
      }
    } catch (error) {
      console.error(`Error parsing file ${uri.fsPath}:`, error);
    }
  });

  watcher.onDidCreate(async (uri) => {
    console.log(`New TypeScript file created: ${uri.fsPath}`);
    try {
      await stepParser.parseStepFiles(uri.fsPath);
      console.log(`Successfully parsed new file: ${uri.fsPath}`);

      // Re-run diagnostics on all feature files after step file changes
      const featureFiles = await vscode.workspace.findFiles('**/*.feature');
      for (const file of featureFiles) {
        const document = await vscode.workspace.openTextDocument(file);
        await diagnosticsProvider.provideDiagnostics(document);
        await stepStateDiagnosticsProvider.provideDiagnostics(document);
      }
    } catch (error) {
      console.error(`Error parsing file ${uri.fsPath}:`, error);
    }
  });

  // Add watcher to disposables
  context.subscriptions.push(watcher);

  // Register providers
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    'gherkin',
    new CompletionProvider(stepParser),
    'Given',
    'When',
    'Then',
  );
  console.log('✅ CompletionItemProvider registered');

  // Register definition provider
  const definitionDisposable = vscode.languages.registerDefinitionProvider(
    'gherkin',
    new DefinitionProvider(stepParser),
  );
  console.log('✅ DefinitionProvider registered');

  // Add both disposables to subscriptions
  context.subscriptions.push(completionDisposable, definitionDisposable);

  // Initialize diagnostics
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('stepForge');
  context.subscriptions.push(diagnosticCollection);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "step-forge" is now active!');

  const outputChannel = vscode.window.createOutputChannel(
    'My Gherkin Extension',
  );
  outputChannel.appendLine('Extension activated');

  const diagnosticsProvider = new StepDefinitionDiagnosticsProvider(stepParser);
  const stepStateDiagnosticsProvider = new StepStateDiagnosticsProvider(
    stepParser,
    context,
  );

  // Run diagnostics on all existing feature files
  const featureFiles = await vscode.workspace.findFiles('**/*.feature');
  console.log(
    `Found ${featureFiles.length} feature files for initial diagnostics`,
  );
  for (const file of featureFiles) {
    const document = await vscode.workspace.openTextDocument(file);
    await diagnosticsProvider.provideDiagnostics(document);
    await stepStateDiagnosticsProvider.provideDiagnostics(document);
  }

  // Register for feature files
  context.subscriptions.push(
    diagnosticsProvider, // Add the provider itself to disposables
    stepStateDiagnosticsProvider, // Add the new provider to disposables
    vscode.workspace.onDidOpenTextDocument(async (doc) => {
      if (doc.languageId === 'gherkin') {
        await diagnosticsProvider.provideDiagnostics(doc);
        await stepStateDiagnosticsProvider.provideDiagnostics(doc);
      }
    }),
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.languageId === 'gherkin') {
        await diagnosticsProvider.provideDiagnostics(event.document);
        await stepStateDiagnosticsProvider.provideDiagnostics(event.document);
      }
    }),
  );

  // Add this registration
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      'gherkin',
      stepStateDiagnosticsProvider,
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      },
    ),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
