Feature: User information can be saved

    Scenario: Updating a user's username
        Given I have a user named "Furball"
    Given an existing user
        When I save the user
        Then the user's real name should not change