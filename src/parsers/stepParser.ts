import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as path from 'path';

export interface StepDefinition {
  pattern: string;
  type: 'given' | 'when' | 'then';
  sourceFile: string;
  line: number;
  column: number;
  dependencies: {
    given?: Record<string, 'required' | 'optional'>;
    when?: Record<string, 'required' | 'optional'>;
    then?: Record<string, 'required' | 'optional'>;
  };
  returnType: {
    [key: string]: {
      type: string;
      optional: boolean;
    };
  };
}

export class StepParser {
  private stepDefinitions: StepDefinition[] = [];
  private program: ts.Program | undefined;
  private outputChannel: any;

  constructor() {
    this.outputChannel = { appendLine: console.log };
  }

  async parseStepFiles(
    stepFilesGlob: vscode.GlobPattern | string,
  ): Promise<StepDefinition[]> {
    this.outputChannel.appendLine(
      `[StepParser] Searching for step files matching: ${stepFilesGlob}`,
    );

    // Handle both glob patterns and individual files
    const files =
      typeof stepFilesGlob === 'string' && !stepFilesGlob.includes('*')
        ? [vscode.Uri.file(stepFilesGlob)]
        : await vscode.workspace.findFiles(stepFilesGlob);

    this.outputChannel.appendLine(
      `[StepParser] Found ${files.length} step files`,
    );

    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';
    const configPath = ts.findConfigFile(
      workspaceRoot,
      ts.sys.fileExists,
      'tsconfig.json',
    );

    if (!configPath) {
      this.outputChannel.appendLine(
        '[StepParser] Could not find tsconfig.json',
      );
      throw new Error('Could not find tsconfig.json');
    }
    this.outputChannel.appendLine(
      `[StepParser] Using tsconfig at: ${configPath}`,
    );

    const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      path.dirname(configPath),
    );

    this.program = ts.createProgram(
      files.map((f) => f.fsPath),
      options,
    );

    this.stepDefinitions = [];

    for (const file of files) {
      this.outputChannel.appendLine(
        `[StepParser] Parsing file: ${file.fsPath}`,
      );
      await this.parseFile(file);
    }

    this.outputChannel.appendLine(
      `[StepParser] Found ${this.stepDefinitions.length} step definitions:`,
    );
    this.stepDefinitions.forEach((step) => {
      this.outputChannel.appendLine(
        `[StepParser]   ${step.type.toUpperCase()}: ${step.pattern} (${
          step.sourceFile
        }:${step.line})`,
      );
    });

    return this.stepDefinitions;
  }

  private async parseFile(file: vscode.Uri) {
    this.outputChannel.appendLine(`[StepParser] Parsing file: ${file.fsPath}`);
    if (!this.program) {
      return;
    }

    this.outputChannel.appendLine(`[StepParser] Program: ${this.program}`);
    const sourceFile = this.program.getSourceFile(file.fsPath);
    if (!sourceFile) {
      return;
    }
    this.outputChannel.appendLine(`[StepParser] Source file: ${sourceFile}`);

    const typeChecker = this.program.getTypeChecker();
    this.outputChannel.appendLine(`[StepParser] Type checker: ${typeChecker}`);

    ts.forEachChild(sourceFile, (node) => {
      this.visitNode(node, typeChecker, file.fsPath);
    });
  }

  private visitNode(
    node: ts.Node,
    typeChecker: ts.TypeChecker,
    filePath: string,
  ) {
    if (ts.isCallExpression(node)) {
      const { expression } = node;

      if (ts.isIdentifier(expression)) {
        const builderTypes = ['GivenBuilder', 'WhenBuilder', 'ThenBuilder'];
        const symbol = typeChecker.getSymbolAtLocation(expression);
        this.outputChannel.appendLine(`[StepParser] Symbol: ${symbol}`);
        if (symbol && builderTypes.includes(symbol.getName())) {
          this.outputChannel.appendLine(
            `[StepParser] Builder type: ${symbol.getName()}`,
          );
          this.processBuilderChain(
            node,
            symbol.getName(),
            typeChecker,
            filePath,
          );
        }
      }
    }

    ts.forEachChild(node, (child) =>
      this.visitNode(child, typeChecker, filePath),
    );
  }

  private processBuilderChain(
    node: ts.CallExpression,
    builderType: string,
    typeChecker: ts.TypeChecker,
    filePath: string,
  ) {
    // Find the root of the builder chain first
    let rootNode: ts.Node = node;
    while (rootNode.parent && !ts.isExpressionStatement(rootNode.parent)) {
      rootNode = rootNode.parent as ts.Node;
    }

    this.outputChannel.appendLine(
      `[StepParser] Found root node: ${ts.SyntaxKind[rootNode.kind]}`,
    );

    let currentNode: ts.Node = node;
    let chainComplete = false;
    let pattern: string | undefined;
    let dependencies: StepDefinition['dependencies'] = this.extractDependencies(
      rootNode,
      typeChecker,
    );
    this.outputChannel.appendLine(
      `[StepParser] Extracted dependencies: ${JSON.stringify(
        dependencies,
        null,
        2,
      )}`,
    );
    let stepFunction: ts.Node | undefined;

    while (!chainComplete) {
      const parent = currentNode.parent;
      if (!parent) {
        break;
      }

      if (ts.isCallExpression(parent)) {
        const parentExp = parent.expression;
        if (
          ts.isPropertyAccessExpression(parentExp) &&
          parentExp.name.text === 'step'
        ) {
          stepFunction = parent.arguments[0];
          pattern = this.extractPattern(node.arguments[0]);
          chainComplete = true;
        } else if (
          ts.isPropertyAccessExpression(parentExp) &&
          parentExp.name.text === 'register'
        ) {
          pattern = this.extractPattern(node.arguments[0]);
          chainComplete = true;
        }
      }

      if (ts.isPropertyAccessExpression(parent)) {
        currentNode = parent;
      } else {
        currentNode = parent;
      }
    }

    if (pattern && stepFunction) {
      const stepDef: StepDefinition = {
        pattern,
        type: builderType.replace('Builder', '').toLowerCase() as
          | 'given'
          | 'when'
          | 'then',
        sourceFile: filePath,
        line:
          ts.getLineAndCharacterOfPosition(
            node.getSourceFile(),
            node.getStart(),
          ).line + 1,
        column:
          ts.getLineAndCharacterOfPosition(
            node.getSourceFile(),
            node.getStart(),
          ).character + 1,
        dependencies,
        returnType: this.extractStepReturnType(stepFunction, typeChecker),
      };

      this.outputChannel.appendLine(
        '\n[StepParser] Creating new step definition:',
      );
      this.outputChannel.appendLine(`  Type: ${stepDef.type.toUpperCase()}`);
      this.outputChannel.appendLine(`  Pattern: ${stepDef.pattern}`);
      this.outputChannel.appendLine(
        `  Location: ${stepDef.sourceFile}:${stepDef.line}:${stepDef.column}`,
      );
      this.outputChannel.appendLine(
        `  Dependencies before push: ${JSON.stringify(
          stepDef.dependencies,
          null,
          2,
        )}`,
      );

      this.stepDefinitions.push(stepDef);

      // Verify the step was added correctly
      const addedStep = this.stepDefinitions[this.stepDefinitions.length - 1];
      this.outputChannel.appendLine(
        `  Dependencies after push: ${JSON.stringify(
          addedStep.dependencies,
          null,
          2,
        )}`,
      );
    }
  }

  private extractPattern(patternNode: ts.Node | undefined): string | undefined {
    if (!patternNode) {
      return undefined;
    }

    if (ts.isStringLiteral(patternNode)) {
      return patternNode.text;
    } else if (
      ts.isArrowFunction(patternNode) ||
      ts.isFunctionExpression(patternNode)
    ) {
      const body = patternNode.body;

      // Handle direct string literals
      if (ts.isStringLiteral(body)) {
        return body.text;
      }

      // Handle template literals
      if (
        ts.isTemplateExpression(body) ||
        ts.isNoSubstitutionTemplateLiteral(body)
      ) {
        return ts.isTemplateExpression(body)
          ? body.head.text +
              body.templateSpans
                .map(
                  (span) =>
                    `{${span.expression.getText()}}` + span.literal.text,
                )
                .join('')
          : body.text;
      }

      // Handle return statements in block bodies
      if (ts.isBlock(body)) {
        const returnStatement = body.statements.find(ts.isReturnStatement);
        if (returnStatement?.expression) {
          if (ts.isStringLiteral(returnStatement.expression)) {
            return returnStatement.expression.text;
          }
          if (
            ts.isTemplateExpression(returnStatement.expression) ||
            ts.isNoSubstitutionTemplateLiteral(returnStatement.expression)
          ) {
            return ts.isTemplateExpression(returnStatement.expression)
              ? returnStatement.expression.head.text +
                  returnStatement.expression.templateSpans
                    .map(
                      (span) =>
                        `{${span.expression.getText()}}` + span.literal.text,
                    )
                    .join('')
              : returnStatement.expression.text;
          }
        }
      }
    }
    return undefined;
  }

  private extractDependencies(
    node: ts.Node,
    typeChecker: ts.TypeChecker,
  ): StepDefinition['dependencies'] {
    this.outputChannel.appendLine(
      '\n[StepParser] Starting dependency extraction...',
    );

    if (ts.isCallExpression(node)) {
      // Get the entire chain of method calls
      let chain: ts.CallExpression[] = [];
      let current = node;

      while (ts.isCallExpression(current)) {
        chain.push(current);
        if (ts.isPropertyAccessExpression(current.expression)) {
          this.outputChannel.appendLine(
            `[StepParser] Found method in chain: ${current.expression.name.text}`,
          );
          if (
            current.expression.expression &&
            ts.isCallExpression(current.expression.expression)
          ) {
            current = current.expression.expression;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Find the dependencies call in the chain
      for (const call of chain) {
        if (!ts.isPropertyAccessExpression(call.expression)) {
          continue;
        }

        this.outputChannel.appendLine(
          `[StepParser] Checking call: ${call.expression.name.text}`,
        );

        if (call.expression.name.text === 'dependencies') {
          this.outputChannel.appendLine(
            '[StepParser] Found dependencies call!',
          );

          if (call.arguments.length > 0) {
            const depsArg = call.arguments[0];
            this.outputChannel.appendLine(
              `[StepParser] Argument kind: ${ts.SyntaxKind[depsArg.kind]}`,
            );

            if (ts.isObjectLiteralExpression(depsArg)) {
              this.outputChannel.appendLine(
                '[StepParser] Processing dependencies object...',
              );
              const result: StepDefinition['dependencies'] = {};

              for (const prop of depsArg.properties) {
                this.outputChannel.appendLine(
                  `[StepParser] Processing property: ${prop.getText()}`,
                );

                if (
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.name)
                ) {
                  const stepType = prop.name.text as 'given' | 'when' | 'then';
                  this.outputChannel.appendLine(
                    `[StepParser] Found step type: ${stepType}`,
                  );
                  result[stepType] = {};

                  if (ts.isObjectLiteralExpression(prop.initializer)) {
                    this.outputChannel.appendLine(
                      `[StepParser] Processing ${stepType} dependencies...`,
                    );

                    for (const depProp of prop.initializer.properties) {
                      this.outputChannel.appendLine(
                        `[StepParser] Processing dependency property: ${depProp.getText()}`,
                      );

                      if (ts.isPropertyAssignment(depProp)) {
                        this.outputChannel.appendLine(
                          '[StepParser] Is property assignment',
                        );
                        if (ts.isIdentifier(depProp.name)) {
                          this.outputChannel.appendLine(
                            '[StepParser] Has identifier name',
                          );
                          if (ts.isStringLiteral(depProp.initializer)) {
                            const depName = depProp.name.text;
                            const requirement = depProp.initializer.text as
                              | 'required'
                              | 'optional';
                            result[stepType]![depName] = requirement;
                            this.outputChannel.appendLine(
                              `[StepParser] Added dependency: ${stepType}.${depName} = ${requirement}`,
                            );
                          } else {
                            this.outputChannel.appendLine(
                              '[StepParser] Initializer is not a string literal',
                            );
                          }
                        } else {
                          this.outputChannel.appendLine(
                            '[StepParser] Name is not an identifier',
                          );
                        }
                      } else {
                        this.outputChannel.appendLine(
                          '[StepParser] Not a property assignment',
                        );
                      }
                    }
                  } else {
                    this.outputChannel.appendLine(
                      '[StepParser] Initializer is not an object literal',
                    );
                  }
                } else {
                  this.outputChannel.appendLine(
                    '[StepParser] Not a property assignment or identifier',
                  );
                }
              }

              this.outputChannel.appendLine(
                `[StepParser] Final dependencies: ${JSON.stringify(
                  result,
                  null,
                  2,
                )}`,
              );
              return result;
            } else {
              this.outputChannel.appendLine(
                '[StepParser] Argument is not an object literal',
              );
            }
          } else {
            this.outputChannel.appendLine(
              '[StepParser] No arguments found for dependencies call',
            );
          }
        }
      }
    }

    this.outputChannel.appendLine('[StepParser] No dependencies found');
    return {};
  }

  private extractStepReturnType(
    stepFunction: ts.Node,
    typeChecker: ts.TypeChecker,
  ): StepDefinition['returnType'] {
    const functionType = typeChecker.getTypeAtLocation(stepFunction);
    const signatures = functionType.getCallSignatures();
    if (!signatures.length) {
      return {};
    }

    const returnType = signatures[0].getReturnType();

    // Handle Promise return types
    const unwrappedType = this.unwrapPromiseType(returnType, typeChecker);

    return this.extractStateProperties(unwrappedType, typeChecker);
  }

  private unwrapPromiseType(
    type: ts.Type,
    typeChecker: ts.TypeChecker,
  ): ts.Type {
    if (type.symbol?.name === 'Promise') {
      const typeArguments = (type as ts.TypeReference).typeArguments;
      if (typeArguments && typeArguments.length > 0) {
        return typeArguments[0];
      }
    }
    return type;
  }

  private extractStateProperties(
    type: ts.Type,
    typeChecker: ts.TypeChecker,
  ): StepDefinition['returnType'] {
    const properties: StepDefinition['returnType'] = {};

    // Get the properties of the type
    type.getProperties().forEach((prop) => {
      const propType = typeChecker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration!,
      );
      const propTypeString = typeChecker.typeToString(propType);

      properties[prop.name] = {
        type: propTypeString,
        optional: (prop.flags & ts.SymbolFlags.Optional) !== 0,
      };
    });

    return properties;
  }

  private matchPattern(text: string, pattern: string): boolean {
    console.log(
      `[StepParser] Entered matchPattern with text: "${text}" and pattern: "${pattern}"`,
    );

    // First, temporarily replace the variable placeholders
    const placeholder = '###VARIABLE###';
    let regexPattern = pattern
      .replace(/\{[^}]+\}/g, placeholder)
      .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
      .replace(new RegExp(placeholder, 'g'), '(.+)');

    const patternRegex = new RegExp(`^${regexPattern}$`, 'i');
    console.log(`[StepParser] Created regex pattern: ${patternRegex}`);

    return patternRegex.test(text);
  }

  private matchPartialPattern(text: string, pattern: string): boolean {
    console.log(
      `[StepParser] Entered matchPartialPattern with text: "${text}" and pattern: "${pattern}"`,
    );

    // Convert the text into a regex pattern that matches the start of the pattern
    const escapedText = text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const textRegex = new RegExp(`^${escapedText}`, 'i');

    // Remove variable placeholders from pattern for comparison
    const simplifiedPattern = pattern.replace(/\{[^}]+\}/g, 'value');

    console.log(
      `[StepParser] Checking if "${simplifiedPattern}" starts with "${escapedText}"`,
    );
    return textRegex.test(simplifiedPattern);
  }

  getMatchingSteps(
    stepText: string,
    type: 'given' | 'when' | 'then',
    partial: boolean = false,
  ): StepDefinition[] {
    this.outputChannel.appendLine(
      `\n[StepParser] Getting matching steps for: "${stepText}" (type: ${type})`,
    );

    const matchingSteps = this.stepDefinitions.filter(
      (step) => step.type === type,
    );
    this.outputChannel.appendLine(
      `[StepParser] Found ${matchingSteps.length} steps of type ${type}`,
    );

    // Debug log all steps and their dependencies
    matchingSteps.forEach((step) => {
      this.outputChannel.appendLine(`[StepParser] Step: ${step.pattern}`);
      this.outputChannel.appendLine(
        `[StepParser] Match dependencies: ${JSON.stringify(
          step.dependencies,
          null,
          2,
        )}`,
      );
    });

    const matchFunction = partial
      ? this.matchPartialPattern
      : this.matchPattern;
    const matchingPatterns = matchingSteps.filter((step) =>
      matchFunction.call(this, stepText, step.pattern),
    );

    this.outputChannel.appendLine(
      `[StepParser] Found ${matchingPatterns.length} matching patterns`,
    );
    // Debug log matching steps and their dependencies
    matchingPatterns.forEach((step) => {
      this.outputChannel.appendLine(
        `[StepParser] Matched Step: ${step.pattern}`,
      );
      this.outputChannel.appendLine(
        `[StepParser] Matched Dependencies: ${JSON.stringify(
          step.dependencies,
          null,
          2,
        )}`,
      );
    });

    return matchingPatterns;
  }

  getStepAtLocation(
    filePath: string,
    line: number,
    column: number,
  ): StepDefinition | undefined {
    return this.stepDefinitions.find(
      (step) =>
        step.sourceFile === filePath &&
        step.line === line &&
        step.column === column,
    );
  }

  getAllSteps(): StepDefinition[] {
    return this.stepDefinitions;
  }
}
