import {
  givenBuilder,
  thenBuilder,
  whenBuilder,
} from '@step-forge/step-forge';
import { GivenState, WhenState, ThenState } from './world';

// Given steps
givenBuilder<GivenState>().statement('I have a sample step')
  .step(({ variables }) => {
    return {
      aString: "I'm a happy string",
    };
  })
  .register();

givenBuilder<GivenState>().statement('I want to see what it does')
  .dependencies({
    given: {
      aString: 'required',
      anArrayOfArraysOfInts: 'optional',
      anArrayOfArraysOfStrings: 'optional',
    },
  })
  .step(({ variables }) => {
    return {};
  })
  .register();

// When step
whenBuilder<GivenState,WhenState>().statement((times: string) => `I press a button ${times} times`)
  .step(({ variables }) => {
    const [times] = variables;
    return {};
  })
  .register();

whenBuilder<GivenState, WhenState>().statement(
  (a: string, b: string, c: string, d: string) =>
    `I press a button ${a} ${b} and ${c} or ${d}`,
)
  .dependencies({
    given: {
      aString: 'required',
    },
  })
  .step(({ variables }) => {
    return {};
  })
  .register();

// Then steps
thenBuilder<GivenState, WhenState, ThenState>().statement('I should see things')
  .dependencies({
    given: {
      anArrayOfArraysOfInts: 'required',
    },
    when: {
      anInt: 'required',
    },
    then: {
      anArrayOfArraysOfInts: 'required',
    },
  })
  .step(({ variables }) => {
    return {};
  })
  .register();

thenBuilder<GivenState, WhenState, ThenState>().statement('probably more stuff')
  .step(({ variables }) => {
    return {};
  })
  .register();

thenBuilder<GivenState, WhenState, ThenState>().statement('random stuff')
  .step(({ variables }) => {
    return {};
  })
  .register();
