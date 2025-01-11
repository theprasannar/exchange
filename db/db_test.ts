import pool from "./db";



(async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Database connection successful:', res.rows[0]);
    } catch (err) {
        console.error('Failed to connect to PostgreSQL:', err);
    } finally {
        pool.end(); // Close the connection after the test
    }
})();
