import {
  GivenBuilder,
  ThenBuilder,
  WhenBuilder,
} from './step-forge-types/stepTypes';

// Given steps
GivenBuilder('I have a sample step')
  .step(({ variables }) => {
    return {
      aString: "I'm a happy string",
    };
  })
  .register();

GivenBuilder('I want to see what it does')
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
WhenBuilder((times: string) => `I press a button ${times} times`)
  .step(({ variables }) => {
    const [times] = variables;
    return {};
  })
  .register();

WhenBuilder(
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
ThenBuilder('I should see things')
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

ThenBuilder('probably more stuff')
  .step(({ variables }) => {
    return {};
  })
  .register();
