import{test, expect} from '../fixtures/auth';
import { CheckoutPage } from '../pages/CheckoutPage';

test.describe('Checkout', () => {
    test('checkout to information page', async ({ page, loggedInPage }) => {
        const checkoutPage = new CheckoutPage(page);