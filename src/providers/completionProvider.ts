import * as vscode from 'vscode';
import { StepParser } from '../parsers/stepParser';

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private stepParser: StepParser) {
    console.log('🔨 CompletionProvider constructed');
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    console.log('🔍 provideCompletionItems called');
    console.log('Document:', document.uri.toString());
    console.log('Position:', position.line, position.character);

    const linePrefix = document
      .lineAt(position)
      .text.substr(0, position.character);
    console.log('Current line prefix:', linePrefix);

    // Determine step type
    const stepType = this.determineStepType(document, position);
    console.log('Determined step type:', stepType);

    if (!stepType) {
      console.log('❌ No valid step type found');
      return [];
    }

    // Get the partial text after Given/When/Then/And/But
    const match = linePrefix.match(/^\s*(Given|When|Then|And|But)\s+(.*)$/);
    if (!match) {
      console.log('❌ No match found for step pattern');
      return [];
    }

    const keyword = match[1];
    const partialText = match[2];
    console.log(
      `✅ Found keyword: "${keyword}", partial text: "${partialText}"`,
    );

    // Get matching steps from the parser
    const allSteps = this.stepParser.getAllSteps();
    console.log('Total available steps:', allSteps.length);
    console.log(
      'All step patterns:',
      allSteps.map((s) => s.pattern),
    );
    console.log('My partial text is', partialText);
    const matchingSteps = this.stepParser.getMatchingSteps(
      partialText,
      stepType,
      true,
    );
    console.log('Matching steps found:', matchingSteps.length);
    console.log(
      'Matching step patterns:',
      matchingSteps.map((s) => s.pattern),
    );

    // Convert steps to completion items
    const completionItems = matchingSteps.map((step) => {
      const completionItem = new vscode.CompletionItem(
        step.pattern,
        vscode.CompletionItemKind.Snippet,
      );

      // Replace parameters with snippet placeholders
      let tabIndex = 1;
      let completionText = step.pattern.replace(
        /\{(\w+)(?::(\w+))?\}/g,
        (match, paramName, paramType) => {
          console.log(
            `Processing parameter: ${paramName} (type: ${paramType})`,
          );

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
      completionItem.detail = `${stepType} step from ${step.sourceFile}`;
      completionItem.filterText = step.pattern;

      console.log('Created completion item:', {
        pattern: step.pattern,
        insertText: completionText,
        detail: completionItem.detail,
      });

      return completionItem;
    });

    console.log(`Returning ${completionItems.length} completion items`);
    return completionItems;
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
      console.log('Returning Given completion');
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
