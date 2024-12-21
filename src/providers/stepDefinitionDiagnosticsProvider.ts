import * as vscode from 'vscode';
import { StepParser } from '../parsers/stepParser';

export class StepDefinitionDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private stepParser: StepParser) {
    console.log('DiagnosticsProvider: Initializing...');
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('cucumber-steps');
  }

  public async provideDiagnostics(
    document: vscode.TextDocument,
  ): Promise<void> {
    console.log(`DiagnosticsProvider: Checking document ${document.uri}`);
    const diagnostics: vscode.Diagnostic[] = [];

    // Get all step lines in the document
    const text = document.getText();
    console.log('Document text:', text);

    const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.+)$/gm;
    let match;

    while ((match = stepRegex.exec(text)) !== null) {
      console.log('Found step match:', match[0]);
      const stepText = match[2];
      const line = document.positionAt(match.index).line;

      // Calculate the start position excluding leading whitespace
      const lineStartIndex = text.lastIndexOf('\n', match.index) + 1;
      const actualStepStart = match.index + match[0].indexOf(match[1]); // match[1] is the keyword (Given/When/Then/etc)
      const startChar = actualStepStart - lineStartIndex;

      const range = new vscode.Range(
        new vscode.Position(line, startChar),
        new vscode.Position(line, startChar + match[0].trim().length),
      );

      console.log(
        `Step "${stepText}" found at line ${line}, char ${startChar}`,
      );

      // Determine step type
      const stepType = this.determineStepType(
        document,
        document.positionAt(match.index),
      );
      console.log('Determined step type:', stepType);

      if (stepType) {
        // Try to find matching steps
        const matchingSteps = this.stepParser.getMatchingSteps(
          stepText,
          stepType,
          false, // Use exact matching (this is the default)
        );
        console.log(
          `Found ${matchingSteps.length} matching steps for "${stepText}"`,
        );

        if (matchingSteps.length === 0) {
          console.log(`Creating diagnostic for undefined step: "${stepText}"`);
          const diagnostic = new vscode.Diagnostic(
            range,
            `No step definition found for: "${stepText}"`,
            vscode.DiagnosticSeverity.Error,
          );
          diagnostics.push(diagnostic);
        }
      }
    }

    console.log(`Setting ${diagnostics.length} diagnostics for document`);
    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private determineStepType(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): 'given' | 'when' | 'then' | undefined {
    const currentLine = document.lineAt(position).text;
    const match = currentLine.match(/^\s*(Given|When|Then|And|But)/);

    if (!match) {
      console.log('No step type match found in line:', currentLine);
      return undefined;
    }

    console.log('Found step keyword:', match[1]);

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
      console.log('Looking up previous step type for And/But');
      for (let lineNo = position.line - 1; lineNo >= 0; lineNo--) {
        const prevLine = document.lineAt(lineNo).text;
        const prevMatch = prevLine.match(/^\s*(Given|When|Then|And|But)/);

        if (prevMatch) {
          console.log('Found previous step keyword:', prevMatch[1]);
          switch (prevMatch[1]) {
            case 'Given':
              return 'given';
            case 'When':
              return 'when';
            case 'Then':
              return 'then';
            // Continue looking up if it's another And/But
          }
        }
      }
    }

    console.log('No step type determined');
    return undefined;
  }

  public dispose() {
    console.log('DiagnosticsProvider: Disposing...');
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
  }
}
