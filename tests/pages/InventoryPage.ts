import {Page, Locator} from '@playwright/test';

export class InventoryPage {
    readonly page: Page;
    readonly sortDropdown: Locator;
    readonly itemNames: Locator;
    readonly itemPrices: Locator;
    readonly cartBadge: Locator;
    readonly cartLink: Locator;
    readonly addToCartButtons: Locator;
    readonly removeButtons: Locator;
    readonly openMenuButton: Locator;
    readonly logoutLink: Locator;
    readonly inventoryImages: Locator;

    constructor(page: Page) {
        this.page = page;
        this.sortDropdown = page.locator('[data-test="product-sort-container"]');
        this.itemNames = page.locator('[data-test="inventory-item-name"]');
        this.itemPrices = page.locator('[data-test="inventory-item-price"]');
        this.cartBadge = page.locator('[data-test="shopping-cart-badge"]');
        this.cartLink = page.locator('[data-test="shopping-cart-link"]');
        this.addToCartButtons = page.getByRole('button', { name: 'Add to cart' });
        this.removeButtons = page.getByRole('button', { name: 'Remove' });
        this.openMenuButton = page.getByRole('button', { name: 'Open Menu' });
        this.logoutLink = page.locator('[data-test="logout-sidebar-link"]');
        this.inventoryImages = page.locator('[data-test="inventory-item"] img');
    }

    async addItemToCart(itemName: string) {
        const item = this.page.locator('[data-test="inventory-item"]').filter({ hasText: itemName });
        await item.getByRole('button', { name: 'Add to cart' }).click();
    }

    async sortBy(value: string) {
        await this.sortDropdown.selectOption(value);
    }

    async getItemCount(): Promise<number> {
        return await this.itemNames.count();
    }
    
    async gotoCart(){
        await this.cartLink.click();
        await this.page.waitForURL('/cart.html');
    }

    async getPrices(): Promise<number[]> {
        const texts=await this.itemPrices.allTextContents();
        return texts.map(text => parseFloat(text.replace('$', '')));
    }

    async getItemNames(): Promise<string[]> {
        return await this.itemNames.allTextContents();
    }

    imageForItem(itemName: string): Locator {
        return this.page.locator('[data-test="inventory-item"]')
        .filter({ hasText: itemName })
        .locator('img');}

    async getImageSrcs(): Promise<(string | null)[]> {
        return await this.inventoryImages.evaluateAll((imgs) => imgs
        .map(img => (img as HTMLImageElement).src));
    }

     async removeItemFromCart(itemName: string) {
        const item = this.page.locator('[data-test="inventory-item"]').filter({ hasText: itemName });
        await item.getByRole('button', { name: 'Remove' }).click();
    }

    async logout(){
        await this.openMenuButton.click();
        await this.logoutLink.click();
        await this.page.waitForURL('/');
    }

    }