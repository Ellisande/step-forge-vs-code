import {
  Parser,
  AstBuilder,
  TokenScanner,
  GherkinClassicTokenMatcher,
  compile,
} from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import * as vscode from 'vscode';

export interface ParsedStep {
  text: string;
  keyword: string;
  line: number;
  column: number;
  type: 'Given' | 'When' | 'Then' | 'And' | 'But';
}

export interface ParsedScenario {
  name: string;
  line: number;
  steps: ParsedStep[];
}

export interface ParsedFeature {
  scenarios: ParsedScenario[];
  uri: string;
}

export class GherkinParser {
  private idGenerator = IdGenerator.uuid();
  private builder = new AstBuilder(this.idGenerator);
  private matcher = new GherkinClassicTokenMatcher();
  private parser = new Parser(this.builder, this.matcher);

  async parseFile(document: vscode.TextDocument): Promise<ParsedFeature> {
    console.log(
      `[GherkinParser] Parsing feature file: ${document.uri.toString()}`,
    );
    const content = document.getText();
    try {
      const gherkinDocument = this.parser.parse(content);
      console.log(`[GherkinParser] Successfully parsed Gherkin document`);

      const pickles = compile(
        gherkinDocument,
        document.uri.toString(),
        this.idGenerator,
      );
      console.log(`[GherkinParser] Compiled ${pickles.length} pickles`);

      const parsedFeature = this.processGherkinDocument(
        gherkinDocument,
        document.uri.toString(),
      );

      console.log(
        `[GherkinParser] Processed feature with ${parsedFeature.scenarios.length} scenarios:`,
      );
      parsedFeature.scenarios.forEach((scenario) => {
        console.log(
          `[GherkinParser]   Scenario: ${scenario.name} (line ${scenario.line})`,
        );
        scenario.steps.forEach((step) => {
          console.log(
            `[GherkinParser]     ${step.type} ${step.text} (line ${step.line})`,
          );
        });
      });

      return parsedFeature;
    } catch (error) {
      console.error('[GherkinParser] Error parsing Gherkin document:', error);
      return { scenarios: [], uri: document.uri.toString() };
    }
  }

  private processGherkinDocument(document: any, uri: string): ParsedFeature {
    if (!document?.feature) {
      return { scenarios: [], uri };
    }

    const scenarios: ParsedScenario[] = [];

    for (const child of document.feature.children) {
      if (child.scenario) {
        scenarios.push(this.processScenario(child.scenario));
      }
    }

    return {
      scenarios,
      uri,
    };
  }

  private processScenario(scenario: any): ParsedScenario {
    return {
      name: scenario.name,
      line: scenario.location.line,
      steps: scenario.steps.map((step: any) => this.processStep(step)),
    };
  }

  private processStep(step: any): ParsedStep {
    const keyword = step.keyword.trim();
    const type = this.determineStepType(keyword);

    return {
      text: step.text,
      keyword,
      line: step.location.line,
      column: step.location.column,
      type,
    };
  }

  private determineStepType(keyword: string): ParsedStep['type'] {
    switch (keyword.toLowerCase()) {
      case 'given':
        return 'Given';
      case 'when':
        return 'When';
      case 'then':
        return 'Then';
      case 'and':
        return 'And';
      case 'but':
        return 'But';
      default:
        return 'Given'; // Default fallback
    }
  }
}
