describe('Basic Atlas Explorer Functionality', () => {
  it('should load the explorer home page', () => {
    cy.visit('/')
    cy.contains('Atlas Explorer').should('be.visible')
    cy.get('[data-testid="network-status"]').should('exist')
  })
})
