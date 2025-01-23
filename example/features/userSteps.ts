import {
  GivenBuilder,
  ThenBuilder,
  WhenBuilder,
} from './step-forge-types/stepTypes';

GivenBuilder((name: string) => `I have a user named ${name}`)
  .step(({ variables: [name] }) => {
    return {
      name,
    };
  })
  .register();

GivenBuilder('an existing user')
  .dependencies({
    given: {
      name: 'required',
    },
  })
  .step(({ given: { name } }) => {
    return { user: { name } };
  })
  .register();

WhenBuilder('I save the user')
  .dependencies({
    given: {
      user: 'required',
    },
  })
  .step(({ given: { user } }) => {
    return { actualUser: user };
  })
  .register();

ThenBuilder("the user's real name should not change")
  .step(() => {
    // do nothing
    return {};
  })
  .register();
