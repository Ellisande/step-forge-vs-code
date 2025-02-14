import {
  givenBuilder,
  thenBuilder,
  whenBuilder,
} from '@step-forge/step-forge';
import { GivenState, WhenState, ThenState } from './world';

givenBuilder<GivenState>().statement((name: string) => `I have a user named ${name}`)
  .step(({ variables: [name] }) => {
    return {
      name,
    };
  })
  .register();

givenBuilder<GivenState>().statement('an existing user')
  .dependencies({
    given: {
      name: 'required',
    },
  })
  .step(({ given: { name } }) => {
    return { user: { name } };
  })
  .register();

whenBuilder<GivenState, WhenState>().statement('I save the user')
  .dependencies({
    given: {
      user: 'required',
    },
  })
  .step(({ given: { user } }) => {
    return { actualUser: user };
  })
  .register();

thenBuilder<GivenState, WhenState, ThenState>().statement("the user's real name should not change")
  .step(() => {
    // do nothing
    return {};
  })
  .register();
