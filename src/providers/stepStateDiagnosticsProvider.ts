import * as vscode from 'vscode';
import { StepDefinition, StepParser } from '../parsers/stepParser';

export class StepStateDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private stepParser: StepParser) {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('cucumber-state');
  }

  async provideDiagnostics(document: vscode.TextDocument) {
    console.log('[State Diagnostics] Starting analysis...');

    console.log('[State Diagnostics] Document is a feature file');
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.+)$/gm;
    let match;
    const availableState: Set<string> = new Set();

    while ((match = stepRegex.exec(text)) !== null) {
      const [_, keyword, stepText] = match;
      console.log(`\n📝 Analyzing step: ${keyword} ${stepText}`);
      const line = document.positionAt(match.index).line;

      // Get the trimmed step text and its start position
      const fullMatch = match[0];
      const trimmedMatch = fullMatch.trim();
      const trimStartOffset = fullMatch.indexOf(trimmedMatch);
      const startChar =
        text.slice(text.lastIndexOf('\n', match.index) + 1, match.index)
          .length + trimStartOffset;

      // Determine step type
      const stepType = this.determineStepType(
        document,
        document.positionAt(match.index),
      );

      if (stepType) {
        const matchingSteps = this.stepParser.getMatchingSteps(
          stepText,
          stepType,
        );

        if (matchingSteps.length === 1) {
          const stepDef = matchingSteps[0];
          console.log(
            '[State Diagnostics] Step dependencies:',
            stepDef.dependencies,
          );
          console.log(
            '[State Diagnostics] Current state keys:',
            Array.from(availableState),
          );

          const missingDependencies = this.validateStepDependencies(
            stepDef,
            availableState,
          );

          if (missingDependencies.length > 0) {
            console.log(
              '[State Diagnostics] Missing dependencies:',
              missingDependencies,
            );
            const range = new vscode.Range(
              line,
              startChar,
              line,
              startChar + trimmedMatch.length,
            );

            // Group missing dependencies by type
            const groupedDeps = missingDependencies.reduce((acc, dep) => {
              const [type, prop] = dep.split('.');
              if (!acc[type]) {
                acc[type] = [];
              }
              acc[type].push(prop);
              return acc;
            }, {} as Record<string, string[]>);

            // Format the message
            const message = ['Scenario state is missing required properties.\n']
              .concat(
                Object.entries(groupedDeps).map(
                  ([type, props]) =>
                    `${
                      type.charAt(0).toUpperCase() + type.slice(1)
                    }: ${props.join(', ')}`,
                ),
              )
              .concat([
                '\nThese properties must be set by previous steps, but no steps in this scenario set them.',
              ])
              .join('\n');

            diagnostics.push(
              new vscode.Diagnostic(
                range,
                message,
                vscode.DiagnosticSeverity.Error,
              ),
            );
          } else {
            console.log('[State Diagnostics] All dependencies satisfied');
          }

          // Add this step's return type properties to available state
          this.updateAvailableState(stepDef, availableState);
          console.log(
            '[State Diagnostics] Updated state keys:',
            Array.from(availableState),
          );
        }
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private determineStepType(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): 'given' | 'when' | 'then' | undefined {
    const currentLine = document.lineAt(position).text;
    const match = currentLine.match(/^\s*(Given|When|Then|And|But)/);

    if (!match) {
      return undefined;
    }

    if (match[1] === 'Given') {
      return 'given';
    }
    if (match[1] === 'When') {
      return 'when';
    }
    if (match[1] === 'Then') {
      return 'then';
    }

    // For And/But, look up previous non-And/But step
    if (match[1] === 'And' || match[1] === 'But') {
      for (let lineNo = position.line - 1; lineNo >= 0; lineNo--) {
        const prevLine = document.lineAt(lineNo).text;
        const prevMatch = prevLine.match(/^\s*(Given|When|Then|And|But)/);

        if (prevMatch) {
          switch (prevMatch[1]) {
            case 'Given':
              return 'given';
            case 'When':
              return 'when';
            case 'Then':
              return 'then';
          }
        }
      }
    }

    return undefined;
  }

  private validateStepDependencies(
    stepDef: StepDefinition,
    availableState: Set<string>,
  ): string[] {
    const missingDependencies: string[] = [];

    console.log(
      '\n[State Diagnostics] Validating dependencies for step:',
      stepDef.pattern,
    );
    console.log(
      '[State Diagnostics] Step dependencies:',
      JSON.stringify(stepDef.dependencies, null, 2),
    );
    console.log(
      '[State Diagnostics] Available state:',
      Array.from(availableState),
    );

    Object.entries(stepDef.dependencies).forEach(([type, dependencies]) => {
      console.log(
        `[State Diagnostics] Checking ${type} dependencies:`,
        dependencies,
      );

      if (!dependencies) {
        console.log(`[State Diagnostics] No ${type} dependencies found`);
        return;
      }

      Object.entries(dependencies).forEach(([prop, requirement]) => {
        console.log(
          `[State Diagnostics] Checking ${type}.${prop} (${requirement})`,
        );
        if (requirement === 'required' && !availableState.has(prop)) {
          console.log(`[State Diagnostics] Missing required property: ${prop}`);
          missingDependencies.push(`${type}.${prop}`);
        }
      });
    });

    console.log(
      '[State Diagnostics] Missing dependencies:',
      missingDependencies,
    );
    return missingDependencies;
  }

  private updateAvailableState(
    stepDef: StepDefinition,
    availableState: Set<string>,
  ) {
    Object.keys(stepDef.returnType).forEach((prop) => {
      availableState.add(prop);
    });
  }

  public dispose() {
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
  }
}
