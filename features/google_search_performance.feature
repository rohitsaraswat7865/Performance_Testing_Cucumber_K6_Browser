Feature: Google Search Performance Testing
  #Google Search Performance Validation
  Background:
    Given page url - "https://www.google.com"

  @WIFI @HighCPU
  Scenario: Load Google homepage and measure page load time
    When I load the main page
    #Assert avg load time until network is idle
    Then the main page load time should be less than 5 seconds

  @4G @LowCPU
  Scenario: Load Google homepage and measure page load time with 4G and CPU throttling
    When I load the main page
    #Assert avg load time until network is idle
    Then the main page load time should be less than 8 seconds

  @3G
  Scenario: Load Google homepage and measure page load time with 3G network
    When I load the main page
    #Assert avg load time until network is idle
    Then the main page load time should be less than 12 seconds

  @WIFI @LowCPU
  Scenario: Load Google homepage and measure page load time with CPU throttling
    When I load the main page
    #Assert avg load time until network is idle
    Then the main page load time should be less than 6 seconds

  @WIFI @HighCPU
  Scenario: Load Google search components and measure performance
    When I load the subcomponents with selectors and text
      | selector                       | expectedText  |
      | body                           | Google        |  
    #Assert component avg load time until expected visibility, accessibility conditions are met
    Then each subcomponent load time should be less than 6 seconds

  @4G @HighCPU
  Scenario: Load Google search components with 4G network
    When I load the subcomponents with selectors and text
      | selector                      | expectedText    |
      | body                          | Google          |
    #Assert component avg load time until expected visibility, accessibility conditions are met
    Then each subcomponent load time should be less than 6 seconds
