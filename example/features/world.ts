import { setWorldConstructor } from '@cucumber/cucumber';
import { BasicWorld } from '@step-forge/step-forge';

export type GivenState = {
  // aString: string;
  // bString: string;
  // anInt: number;
  // anArrayOfStrings: string[];
  // anArrayOfInts: number[];
  // anArrayOfArraysOfStrings: string[][];
  // anArrayOfArraysOfInts: number[][];
  // name: string;
  // user: {
  //   name: string;
  // };
  // actualUser: {
  //   name: string;
  // };
  startingBalance: {
    amount: number;
    currency: string;
  };
  transactions: {
    amount: number;
    type: string;
    currency: string;
  }[];
};

export type WhenState = {
  // aString: string;
  // anInt: number;
  // anArrayOfStrings: string[];
  // anArrayOfInts: number[];
  // anArrayOfArraysOfStrings: string[][];
  // anArrayOfArraysOfInts: number[][];
  // actualUser: {
  //   name: string;
  // };
  balance: {
    amount: number;
    currency: string;
  };
  transactions: {
    amount: number;
    type: string;
    currency: string;
  }[];
};

export type ThenState = {
  // aString: string;
  // anInt: number;
  // anArrayOfStrings: string[];
  // anArrayOfInts: number[];
  // anArrayOfArraysOfStrings: string[][];
  // anArrayOfArraysOfInts: number[][];
};

export class World extends BasicWorld<GivenState, WhenState, ThenState> {
  constructor() {
    super();
  }
}

setWorldConstructor(World);
