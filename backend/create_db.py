import asyncio
import asyncpg

async def run():
    try:
        conn = await asyncpg.connect(user='postgres', password='postgres', database='postgres', host='127.0.0.1')
        try:
            await conn.execute('CREATE DATABASE kambeng')
            print("Database 'kambeng' created successfully!")
        except asyncpg.exceptions.DuplicateDatabaseError:
            print("Database 'kambeng' already exists!")
        await conn.close()
    except Exception as e:
        print(f"Failed to connect or create DB: {e}")

asyncio.run(run())
