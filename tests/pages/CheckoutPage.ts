import{Page, Locator} from '@playwright/test';

export class CheckoutPage {
    readonly page: Page
    readonly firstNameInput: Locator;
    readonly lastNameInput: Locator;
    readonly postalCodeInput: Locator;
    readonly continueButton: Locator;
    readonly cancelButton: Locator;
    readonly finishButton: Locator;
    readonly summaryTotal: Locator;
    readonly completeHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.firstNameInput = page.locator('data-test="firstName"]');
        this.lastNameInput = page.locator('data-test="lastName"]');
        this.postalCodeInput = page.locator('data-test="postalCode"]');
        this.continueButton = page.getByRole('button', { name: 'Continue' });
        this.cancelButton = page.getByRole('button', { name: 'Cancel' });
        this.finishButton = page.getByRole('button', { name: 'Finish' });
        this.summaryTotal = page.locator('data-test="total-label"]');
        this.completeHeader = page.locator('data-test="complete-header"]');
    }