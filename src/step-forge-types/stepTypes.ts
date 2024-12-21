import {
  Given as CucGiven,
  Then as CucThen,
  When as CucWhen,
} from "@cucumber/cucumber";
import { GivenState, ThenState, WhenState, World } from "./worldTypes";
import { pick } from "lodash";

const cucFunctionMap = {
  given: CucGiven,
  when: CucWhen,
  then: CucThen,
};

type VariableParser<T> = {
  parse: (input: string) => T;
  cucType: string;
  _type?: T;
};

const stringParser: VariableParser<string> = {
  parse: (input) => input satisfies string,
  cucType: "{string}",
};

const intParser: VariableParser<number> = {
  parse: (input) => Number.parseInt(input, 10),
  cucType: "{int}",
};

function parseVariables<T extends readonly unknown[]>(
  variables: [...T],
  parsers: { [K in keyof T]: VariableParser<T[K]> }
): { [K in keyof T]: T[K] } {
  return variables.map((variable, index) =>
    parsers[index].parse(String(variable))
  ) as { [K in keyof T]: T[K] };
}

const b = parseVariables([123, "2"], [intParser, stringParser]);
console.error(b);

type InferVariableParsers<Variables extends readonly unknown[]> = {
  [K in keyof Variables]: VariableParser<Variables[K]>;
};

type InferAndReplace<T, U> = never extends T ? U : T;
type GivenStateDeps = Partial<
  Record<keyof GivenState, "required" | "optional">
>;
type WhenStateDeps = Partial<Record<keyof WhenState, "required" | "optional">>;
type ThenStateDeps = Partial<Record<keyof ThenState, "required" | "optional">>;

const step =
  <S extends (...args: [...string[]]) => string>(statementFunction: S) =>
  <
    const G extends GivenStateDeps,
    W extends WhenStateDeps,
    T extends ThenStateDeps
  >({
    given,
    when,
    then,
    stepType,
  }: {
    given?: InferAndReplace<
      G,
      Record<keyof GivenState & keyof G, "required" | "optional">
    >;
    when?: InferAndReplace<
      W,
      Record<keyof WhenState & keyof W, "required" | "optional">
    >;
    then?: InferAndReplace<
      T,
      Record<keyof ThenState & keyof T, "required" | "optional">
    >;
    stepType: "given" | "when" | "then";
  }) =>
  <R extends Partial<GivenState>>(
    stepFunction: (input: {
      variables: string[];
      given: {
        [K in keyof GivenState as K extends keyof G
          ? K
          : never]: G[K] extends "optional"
          ? GivenState[K] | undefined
          : GivenState[K];
      };
      when: {
        [K in keyof WhenState as K extends keyof W
          ? K
          : never]: W[K] extends "optional"
          ? WhenState[K] | undefined
          : WhenState[K];
      };
      then: {
        [K in keyof ThenState as K extends keyof T
          ? K
          : never]: T[K] extends "optional"
          ? ThenState[K] | undefined
          : ThenState[K];
      };
    }) => R | Promise<R>
  ) => {
    return {
      stepFunction,
      dependencies: { given, when, then },
      statementFunction,
      register: () => {
        const argCount = statementFunction.length;
        const argMatchers = Array.from({ length: argCount }, () => "{string}");
        const statement = statementFunction(...argMatchers);
        console.error("The statement is", statement);
        const cucStepFunction = Object.defineProperty(
          async function (this: World, ...args: string[]) {
            const requiredGivenKeys = Object.entries(given ?? {})
              .filter(([_, value]) => value === "required")
              .map(([key]) => key);
            const ensuredGivenValues = requireFromGiven(
              requiredGivenKeys as (keyof GivenState)[],
              this
            );
            const narrowedGiven = {
              ...pick(this.given, Object.keys(given ?? {})),
              ...ensuredGivenValues,
            };
            const requiredWhenKeys = Object.entries(when ?? {})
              .filter(([_, value]) => value === "required")
              .map(([key]) => key);
            const ensuredWhenValues = requireFromWhen(
              requiredWhenKeys as (keyof WhenState)[],
              this
            );
            const narrowedWhen = {
              ...pick(this.when, Object.keys(when ?? {})),
              ...ensuredWhenValues,
            };
            const requiredThenKeys = Object.entries(then ?? {})
              .filter(([_, value]) => value === "required")
              .map(([key]) => key);
            const ensuredThenValues = requireFromThen(
              requiredThenKeys as (keyof ThenState)[],
              this
            );
            const narrowedThen = {
              ...pick(this.then, Object.keys(then ?? {})),
              ...ensuredThenValues,
            };
            const result = await stepFunction({
              variables: args,
              given: narrowedGiven,
              when: narrowedWhen,
              then: narrowedThen,
            });
            this[stepType].merge({
              ...result,
            });
          },
          "length",
          { value: argCount, configurable: true }
        );
        const cucStep = cucFunctionMap[stepType];
        cucStep(statement, cucStepFunction);
        return {
          dependencies: { given, when, then },
          statementFunction,
          stepFunction,
        };
      },
    };
  };

const thenDependencies =
  <S extends (...args: [...string[]]) => string>(statementFunction: S) =>
  <G extends GivenStateDeps, W extends WhenStateDeps, T extends ThenStateDeps>({
    given,
    when,
    then,
  }: {
    given?: InferAndReplace<
      G,
      Record<keyof GivenState & keyof G, "required" | "optional">
    >;
    when?: InferAndReplace<
      W,
      Record<keyof WhenState & keyof W, "required" | "optional">
    >;
    then?: InferAndReplace<
      T,
      Record<keyof ThenState & keyof T, "required" | "optional">
    >;
  }) => {
    return {
      step: step<S>(statementFunction)({ given, when, then, stepType: "then" }),
    };
  };

const whenDependencies =
  <S extends (...args: [...string[]]) => string>(statementFunction: S) =>
  <G extends GivenStateDeps, W extends WhenStateDeps>({
    given,
    when,
  }: {
    given?: InferAndReplace<
      G,
      Record<keyof GivenState & keyof G, "required" | "optional">
    >;
    when?: InferAndReplace<
      W,
      Record<keyof WhenState & keyof W, "required" | "optional">
    >;
  }) => {
    return {
      step: step<S>(statementFunction)({ given, when, stepType: "when" }),
    };
  };

const givenDependencies =
  <S extends (...args: [...string[]]) => string>(statementFunction: S) =>
  <G extends GivenStateDeps>({
    given,
  }: {
    given?: InferAndReplace<
      G,
      Record<keyof GivenState & keyof G, "required" | "optional">
    >;
  }) => {
    return {
      step: step<S>(statementFunction)({
        given,
        stepType: "given",
      }),
    };
  };

export const GivenBuilder = <S extends (...args: [...string[]]) => string>(
  statementFunction: S | string
) => {
  const convertedStatementFunction =
    typeof statementFunction === "string"
      ? () => statementFunction
      : statementFunction;
  return {
    dependencies: givenDependencies(convertedStatementFunction),
    step: step(convertedStatementFunction)({ stepType: "given" }),
  };
};

export const WhenBuilder = <S extends (...args: [...string[]]) => string>(
  statementFunction: S | string
) => {
  const convertedStatementFunction =
    typeof statementFunction === "string"
      ? () => statementFunction
      : statementFunction;
  return {
    dependencies: whenDependencies(convertedStatementFunction),
    step: step(convertedStatementFunction)({ stepType: "when" }),
  };
};

export const ThenBuilder = <S extends (...args: [...string[]]) => string>(
  statementFunction: S | string
) => {
  const convertedStatementFunction =
    typeof statementFunction === "string"
      ? () => statementFunction
      : statementFunction;
  return {
    dependencies: thenDependencies(convertedStatementFunction),
    step: step(convertedStatementFunction)({ stepType: "then" }),
  };
};

export const requireFromGiven = <T extends keyof GivenState>(
  keys: T[],
  world: World
) => {
  keys.forEach((key) => {
    if (!world.given[key]) {
      throw new Error(`Key ${key} is required in given state`);
    }
  });
  return keys.reduce((acc, key) => {
    return {
      ...acc,
      [key]: world.given[key],
    };
  }, {} as { [key in T]: GivenState[key] });
};
export const requireFromWhen = <T extends keyof WhenState>(
  keys: T[],
  world: World
) => {
  keys.forEach((key) => {
    if (!world.when[key]) {
      throw new Error(`Key ${key} is required in when state`);
    }
  });
  return keys.reduce((acc, key) => {
    return {
      ...acc,
      [key]: world.when[key],
    };
  }, {} as { [key in T]: WhenState[key] });
};
export const requireFromThen = <T extends keyof ThenState>(
  keys: T[],
  world: World
) => {
  keys.forEach((key) => {
    if (!world.then[key]) {
      throw new Error(`Key ${key} is required in then state`);
    }
  });
  return keys.reduce((acc, key) => {
    return {
      ...acc,
      [key]: world.then[key],
    };
  }, {} as { [key in T]: ThenState[key] });
};
