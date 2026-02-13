import * as vscode from 'vscode';
import type { StepDefinitionMeta } from '@step-forge/step-forge';
import { analyzer } from '@step-forge/step-forge';
import { DefinitionProvider } from './providers/definitionProvider';
import { CompletionProvider } from './providers/completionProvider';
import { DiagnosticsProvider } from './providers/diagnosticsProvider';

let stepDefinitions: StepDefinitionMeta[] = [];

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  // Initialize providers
  const completionProvider = new CompletionProvider();
  const definitionProvider = new DefinitionProvider();
  const diagnosticsProvider = new DiagnosticsProvider();

  // Parse step definitions
  await parseAllStepFiles();
  updateProviders();

  // Watch for TypeScript file changes in features directories
  const tsWatcher = vscode.workspace.createFileSystemWatcher(
    '**/features/**/*.ts',
    false,
    false,
    false,
  );

  tsWatcher.onDidChange(async () => {
    await parseAllStepFiles();
    updateProviders();
    await runDiagnosticsOnAllFeatureFiles();
  });

  tsWatcher.onDidCreate(async () => {
    await parseAllStepFiles();
    updateProviders();
    await runDiagnosticsOnAllFeatureFiles();
  });

  tsWatcher.onDidDelete(async () => {
    await parseAllStepFiles();
    updateProviders();
    await runDiagnosticsOnAllFeatureFiles();
  });

  // Register providers
  context.subscriptions.push(
    tsWatcher,
    vscode.languages.registerCompletionItemProvider(
      'gherkin',
      completionProvider,
      'Given',
      'When',
      'Then',
    ),
    vscode.languages.registerDefinitionProvider('gherkin', definitionProvider),
    vscode.languages.registerCodeActionsProvider(
      'gherkin',
      diagnosticsProvider,
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      },
    ),
    diagnosticsProvider,
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'gherkin') {
        diagnosticsProvider.provideDiagnostics(doc);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === 'gherkin') {
        diagnosticsProvider.provideDiagnostics(event.document);
      }
    }),
  );

  // Run initial diagnostics on all feature files
  await runDiagnosticsOnAllFeatureFiles();

  function updateProviders() {
    completionProvider.setDefinitions(stepDefinitions);
    definitionProvider.setDefinitions(stepDefinitions);
    diagnosticsProvider.setDefinitions(stepDefinitions);
  }

  async function runDiagnosticsOnAllFeatureFiles() {
    const featureFiles = await vscode.workspace.findFiles('**/*.feature');
    for (const file of featureFiles) {
      const document = await vscode.workspace.openTextDocument(file);
      diagnosticsProvider.provideDiagnostics(document);
    }
  }
}

async function parseAllStepFiles() {
  const tsFiles = await vscode.workspace.findFiles('**/features/**/*.ts');
  const filePaths = tsFiles.map((f) => f.fsPath);

  console.log('[step-forge] Found TS files:', filePaths);

  if (filePaths.length === 0) {
    stepDefinitions = [];
    return;
  }

  try {
    stepDefinitions = analyzer.extractStepDefinitions(filePaths);
    console.log(
      '[step-forge] Extracted definitions:',
      stepDefinitions.map((d) => `${d.sourceFile}:${d.line} ${d.expression}`),
    );
  } catch (error) {
    console.error('[step-forge] Error parsing step definitions:', error);
    stepDefinitions = [];
  }
}

export function deactivate() {}
