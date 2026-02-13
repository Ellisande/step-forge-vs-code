import * as vscode from 'vscode';
import type { StepDefinitionMeta } from '@step-forge/step-forge';

export class CompletionProvider implements vscode.CompletionItemProvider {
  private definitions: StepDefinitionMeta[] = [];

  setDefinitions(definitions: StepDefinitionMeta[]) {
    this.definitions = definitions;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    const effectiveKeyword = this.resolveEffectiveKeyword(document, position);
    if (!effectiveKeyword) {
      return [];
    }

    const match = linePrefix.match(/^\s*(Given|When|Then|And|But)\s+(.*)$/);
    if (!match) {
      return [];
    }

    const partialText = match[2];

    // Filter definitions by step type, then further filter by partial text
    const stepType = effectiveKeyword.toLowerCase() as
      | 'given'
      | 'when'
      | 'then';
    const candidates = this.definitions.filter(
      (d) => d.stepType === stepType,
    );

    // If partial text is empty, show all candidates for this type
    // Otherwise filter to those whose expression starts with the partial text
    const matchingDefs = partialText
      ? candidates.filter((d) =>
          d.expression.toLowerCase().startsWith(partialText.toLowerCase()),
        )
      : candidates;

    return matchingDefs.map((def) => {
      const completionItem = new vscode.CompletionItem(
        def.expression,
        vscode.CompletionItemKind.Snippet,
      );

      let tabIndex = 1;
      const completionText = def.expression.replace(
        /\{(\w+)(?::(\w+))?\}/g,
        (_match, paramName: string, paramType: string) => {
          let placeholder: string;
          switch (paramType?.toLowerCase()) {
            case 'number':
            case 'int':
              placeholder = '0';
              break;
            case 'string':
              placeholder = 'example';
              break;
            case 'boolean':
              placeholder = 'true';
              break;
            default:
              placeholder = paramName;
          }
          return `\${${tabIndex++}:${placeholder}}`;
        },
      );

      completionItem.insertText = new vscode.SnippetString(completionText);
      completionItem.detail = `${stepType} step from ${def.sourceFile}`;
      completionItem.filterText = def.expression;

      return completionItem;
    });
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

    // For And/But, look up previous non-And/But step
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
