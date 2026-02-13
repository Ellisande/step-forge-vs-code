import * as vscode from 'vscode';
import type { StepDefinitionMeta } from '@step-forge/step-forge';
import { analyzer } from '@step-forge/step-forge';

export class DefinitionProvider implements vscode.DefinitionProvider {
  private definitions: StepDefinitionMeta[] = [];

  setDefinitions(definitions: StepDefinitionMeta[]) {
    this.definitions = definitions;
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition | undefined {
    const lineText = document.lineAt(position.line).text;

    const match = lineText.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/);
    if (!match) {
      return undefined;
    }

    const effectiveKeyword = this.resolveEffectiveKeyword(document, position);
    if (!effectiveKeyword) {
      return undefined;
    }

    const stepText = match[2];
    const matchingDefs = analyzer.findMatchingDefinitions(
      stepText,
      effectiveKeyword,
      this.definitions,
    );

    if (matchingDefs.length === 0) {
      return undefined;
    }

    const def = matchingDefs[0];
    return new vscode.Location(
      vscode.Uri.file(def.sourceFile),
      new vscode.Position(def.line - 1, 0),
    );
  }

  private resolveEffectiveKeyword(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): 'Given' | 'When' | 'Then' | undefined {
    const currentLine = document.lineAt(position).text;
    const match = currentLine.match(/^\s*(Given|When|Then|And|But)/);

    if (!match) {
      return undefined;
    }

    if (match[1] === 'Given' || match[1] === 'When' || match[1] === 'Then') {
      return match[1] as 'Given' | 'When' | 'Then';
    }

    for (let lineNo = position.line - 1; lineNo >= 0; lineNo--) {
      const prevLine = document.lineAt(lineNo).text;
      const prevMatch = prevLine.match(/^\s*(Given|When|Then)/);
      if (prevMatch) {
        return prevMatch[1] as 'Given' | 'When' | 'Then';
      }
    }

    return undefined;
  }
}
