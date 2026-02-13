import { givenBuilder, thenBuilder, whenBuilder } from '@step-forge/step-forge';
import { GivenState, ThenState, WhenState } from './world';
import { expect } from 'earl';

givenBuilder<GivenState>()
  .statement(
    (amount: number, currency: string) =>
      `I have a bank account with a balance of ${amount} ${currency}`,
  )
  .step(({ variables: [amount, currency] }) => {
    return {
      startingBalance: {
        amount: amount,
        currency: currency,
      },
      transactions: [],
    };
  })
  .register();

whenBuilder<GivenState, WhenState>()
  .statement(
    (amount: number, currency: string) =>
      `I deposit ${amount} ${currency} into my account`,
  )
  .dependencies({
    given: { startingBalance: 'required', transactions: 'required' },
  })
  .step(
    ({
      variables: [amount, currency],
      given: { startingBalance, transactions },
    }) => {
      if (startingBalance.currency !== currency) {
        throw new Error(
          `Cannot deposit ${amount} ${currency} into an account with a balance of ${startingBalance.amount} ${startingBalance.currency}`,
        );
      }
      return {
        balance: {
          amount: startingBalance.amount + amount,
          currency: currency,
        },
        transactions: [
          ...transactions,
          {
            amount: amount,
            type: 'deposit',
            currency: currency,
          },
        ],
      };
    },
  )
  .register();

thenBuilder<GivenState, WhenState, ThenState>()
  .statement(
    (amount: number, currency: string) =>
      `my account balance should be ${amount} ${currency}`,
  )
  .dependencies({
    when: { balance: 'required', transactions: 'required' },
  })
  .step(
    ({ variables: [amount, currency], when: { balance, transactions } }) => {
      expect(balance.amount).toEqual(amount);
      expect(balance.currency).toEqual(currency);
      expect(transactions).toEqual([
        {
          amount: amount,
          type: 'deposit',
          currency: currency,
        },
      ]);
    },
  )
  .register();

thenBuilder<GivenState, WhenState, ThenState>()
  .statement(
    (count: number) => `there should be ${count} transactions in my account`,
  )
  .dependencies({
    when: { transactions: 'required' },
  })
  .step(({ variables: [count], when: { transactions } }) => {
    expect(transactions.length).toEqual(count);
  })
  .register();

thenBuilder<GivenState, WhenState, ThenState>()
  .statement((type: string) => `the transaction should be a ${type}`)
  .dependencies({
    when: { transactions: 'required' },
  })
  .step(({ variables: [type], when: { transactions } }) => {
    const transaction = transactions.find((t) => t.type === type);
    expect(transaction).toBeTruthy();
  })
  .register();

thenBuilder<GivenState, WhenState, ThenState>()
  .statement(
    (amount: number, currency: string) =>
      `the transaction amount should be ${amount} ${currency}`,
  )
  .dependencies({
    when: { transactions: 'required' },
  })
  .step(({ variables: [amount, currency], when: { transactions } }) => {
    const transaction = transactions.find((t) => t.type === 'deposit');
    expect(transaction).toBeTruthy();
    expect(transaction?.amount).toEqual(amount);
    expect(transaction?.currency).toEqual(currency);
  })
  .register();

whenBuilder<GivenState, WhenState>()
  .statement(
    (amount: number, currency: string) =>
      `I withdraw ${amount} ${currency} from my account`,
  )
  .dependencies({
    given: { startingBalance: 'required', transactions: 'required' },
  })
  .step(
    ({
      variables: [amount, currency],
      given: { startingBalance, transactions },
    }) => {
      //   if (startingBalance.currency !== currency) {
      //     throw new Error(
      //       `Cannot withdraw ${amount} ${currency} from an account with a balance of ${startingBalance.amount} ${startingBalance.currency}`,
      //     );
      //   }
      return {
        // balance: {
        //   amount: startingBalance.amount - amount,
        //   currency: currency,
        // },
        // transactions: [
        //   ...transactions,
        //   {
        //     amount: amount,
        //     type: 'withdrawal',
        //     currency: currency,
        //   },
        // ],
      };
    },
  )
  .register();
