import * as vscode from 'vscode';
import type {
  StepDefinitionMeta,
  Diagnostic,
  ParsedScenario,
} from '@step-forge/step-forge';
import { analyzer } from '@step-forge/step-forge';

export class DiagnosticsProvider implements vscode.CodeActionProvider {
  private definitions: StepDefinitionMeta[] = [];
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('stepForge');
  }

  setDefinitions(definitions: StepDefinitionMeta[]) {
    this.definitions = definitions;
  }

  provideDiagnostics(document: vscode.TextDocument): void {
    const content = document.getText();
    const filePath = document.uri.fsPath;

    let scenarios: ParsedScenario[];
    try {
      scenarios = analyzer.parseFeatureContent(content, filePath);
    } catch {
      this.diagnosticCollection.set(document.uri, []);
      return;
    }

    const libraryDiagnostics: Diagnostic[] = [];
    for (const scenario of scenarios) {
      const matchedSteps = analyzer.matchScenarioSteps(scenario, this.definitions);
      for (const rule of analyzer.defaultRules) {
        libraryDiagnostics.push(...rule.check(scenario, matchedSteps));
      }
    }

    const vscodeDiagnostics = libraryDiagnostics.map((d) =>
      this.toVscodeDiagnostic(d),
    );
    this.diagnosticCollection.set(document.uri, vscodeDiagnostics);
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    const diagnostics = context.diagnostics.filter(
      (d) =>
        d.source === 'step-forge' &&
        d.range.intersection(range) !== undefined,
    );

    for (const diagnostic of diagnostics) {
      const missingDeps = this.extractMissingDependencies(diagnostic.message);

      for (const [type, props] of Object.entries(missingDeps)) {
        const matchingSteps = this.findStepsProducing(type, props);

        for (const step of matchingSteps) {
          const keyword =
            step.stepType.charAt(0).toUpperCase() + step.stepType.slice(1);
          const action = new vscode.CodeAction(
            `Add step: ${step.expression}`,
            vscode.CodeActionKind.QuickFix,
          );

          action.edit = new vscode.WorkspaceEdit();
          const insertPosition = new vscode.Position(
            diagnostic.range.start.line,
            0,
          );
          action.edit.insert(
            document.uri,
            insertPosition,
            `    ${keyword} ${step.expression}\n`,
          );

          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }
    }

    return actions;
  }

  private findStepsProducing(
    type: string,
    properties: string[],
  ): StepDefinitionMeta[] {
    return this.definitions.filter(
      (d) =>
        d.stepType === type &&
        properties.every((prop) => d.produces.includes(prop)),
    );
  }

  private extractMissingDependencies(
    message: string,
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const lines = message.split('\n');

    for (const line of lines) {
      const match = line.match(/^([A-Z][a-z]+): (.+)$/);
      if (match) {
        result[match[1].toLowerCase()] = match[2].split(', ');
      }
    }

    return result;
  }

  private toVscodeDiagnostic(d: Diagnostic): vscode.Diagnostic {
    const range = new vscode.Range(
      new vscode.Position(d.range.startLine - 1, d.range.startColumn - 1),
      new vscode.Position(d.range.endLine - 1, d.range.endColumn - 1),
    );

    let severity: vscode.DiagnosticSeverity;
    switch (d.severity) {
      case 'warning':
        severity = vscode.DiagnosticSeverity.Warning;
        break;
      case 'info':
        severity = vscode.DiagnosticSeverity.Information;
        break;
      default:
        severity = vscode.DiagnosticSeverity.Error;
        break;
    }

    const diagnostic = new vscode.Diagnostic(range, d.message, severity);
    diagnostic.source = d.source;
    diagnostic.code = d.rule;
    return diagnostic;
  }

  dispose() {
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
  }
}
