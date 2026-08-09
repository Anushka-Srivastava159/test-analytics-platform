import{test, expect} from '@playwright/test';

test.describe('Users API', ()=>{
    test('GET /users returns 200 and a non-empty list', async({request})=>{
        const res=await request.get('/users');

        expect(res.status()).toBe(200);
        const users=await res.json();
        expect(Array.isArray(users)).toBe(true);
        expect(users.length).toBeGreaterThan(0);
    });

    test('GET /users/23 return 404 for a missing user', async ({request})=>{
        const res=await request.get('/users/23');

        expect(res.status()).toBe(404);
    });

    test('POST /users creates a user and echoes the payload', async({request})=>{
        const payload={name:'Abc', job:'Xyz'};
        const res=await request.post('/users',{data:payload});

        expect(res.status()).toBe(201);
        const body=await res.json();
        expect(body).toMatchObject(payload);
        expect(typeof body.id).toBe('number');
    });

    test('every user in the list matches the expect schema', async({request})=>{
        const res=await request.get('/users');
        const users=await res.json();

        expect(users.length).toBeGreaterThan(0);
        for(const user of users){
            expect(typeof user.id).toBe('number');
            expect(typeof user.name).toBe('string');
            expect(typeof user.username).toBe('string');
            expect(user.email).toMatch(/@/);
        }

    });
});