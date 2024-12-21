import * as vscode from 'vscode';
import { StepParser } from '../parsers/stepParser';

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(private stepParser: StepParser) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition | undefined {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Check if line starts with Given/When/Then/And/But
    const match = lineText.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/);
    if (!match) {
      return undefined;
    }

    // Determine step type
    let stepType = this.determineStepType(document, position);
    if (!stepType) {
      return undefined;
    }

    // Get the step text
    const stepText = match[2];

    // Find matching steps
    const matchingSteps = this.stepParser.getMatchingSteps(stepText, stepType);
    if (matchingSteps.length === 0) {
      return undefined;
    }

    // Return the location of the first matching step
    const step = matchingSteps[0];
    return new vscode.Location(
      vscode.Uri.file(step.sourceFile),
      new vscode.Position(step.line - 1, step.column - 1),
    );
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
            // Continue looking up if it's another And/But
          }
        }
      }
    }

    return undefined;
  }
}
