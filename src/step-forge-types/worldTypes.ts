import { merge, isArray, isPlainObject } from "lodash";

export type GivenState = {
  aString: string;
  anInt: number;
  anArrayOfStrings: string[];
  anArrayOfInts: number[];
  anArrayOfArraysOfStrings: string[][];
  anArrayOfArraysOfInts: number[][];
};

export type WhenState = {
  aString: string;
  anInt: number;
  anArrayOfStrings: string[];
  anArrayOfInts: number[];
  anArrayOfArraysOfStrings: string[][];
  anArrayOfArraysOfInts: number[][];
};

export type ThenState = {
  aString: string;
  anInt: number;
  anArrayOfStrings: string[];
  anArrayOfInts: number[];
  anArrayOfArraysOfStrings: string[][];
  anArrayOfArraysOfInts: number[][];
};

type StateKind = GivenState | WhenState | ThenState;
type WorldState<State extends StateKind> = {
  readonly [K in keyof State]?: State[K];
};

type MergeableWorldState<T extends StateKind> = WorldState<T> & {
  // Implementers should avoid side-effects. Build a new state.
  merge: (newState: Partial<T>) => void;
};

function mergeCustomizer(objValue: any, srcValue: any) {
  // Note: This can result in duplicate values.
  if (isArray(objValue)) {
    return objValue.concat(srcValue);
  } else if (objValue && !isPlainObject(objValue) && objValue !== srcValue) {
    // We don't want to overwrite a key-value pair, but we should ignore
    // "no-ops" where the new value is the same as the old value.
    throw new Error(
      `Merge would have destroyed previous value ${objValue} with ${srcValue}`
    );
  }
}

export class World {
  private givenState: WorldState<GivenState> = {};
  private whenState: WorldState<WhenState> = {};
  private thenState: WorldState<ThenState> = {};

  public get given(): MergeableWorldState<GivenState> {
    return {
      ...this.givenState,
      merge: (newState: Partial<GivenState>) => {
        this.givenState = merge(
          { ...this.givenState },
          newState,
          mergeCustomizer
        );
      },
    };
  }

  public get when(): MergeableWorldState<WhenState> {
    return {
      ...this.whenState,
      merge: (newState: Partial<WhenState>) => {
        this.whenState = merge(
          { ...this.whenState },
          newState,
          mergeCustomizer
        );
      },
    };
  }

  public get then(): MergeableWorldState<ThenState> {
    return {
      ...this.thenState,
      merge: (newState: Partial<ThenState>) => {
        this.thenState = merge(
          { ...this.thenState },
          newState,
          mergeCustomizer
        );
      },
    };
  }
}
