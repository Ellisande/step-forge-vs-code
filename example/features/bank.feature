Feature: Basic bank functions work

    Scenario: Customer successfully deposits money into their account
        Given I have a bank account with a balance of 100 USD
        When I deposit 50 USD into my account
        Then my account balance should be 150 USD
        And there should be 1 transactions in my account
        And the transaction should be a deposit
        And the transaction amount should be 50 USD
