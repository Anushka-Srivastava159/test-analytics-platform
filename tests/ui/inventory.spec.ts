import {test, expect} from '../fixtures/auth';
import {InventoryPage} from '../pages/InventoryPage';

test.describe('Inventory',()=>{
    test('sorting by price low to high retunrs ascending prices', async ({page, loggedInPage}) => {
        const inventoryPage = new InventoryPage(page);

        await inventoryPage.sortBy('lohi');
        const prices=await inventoryPage.getPrices();

        expect(prices).toEqual([...prices].sort((a,b)=>a-b));
    });
});