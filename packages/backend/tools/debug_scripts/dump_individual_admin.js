const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function getIndividualAdminData() {
    try {
        const adminEmail = "josiassm701@gmail.com";
        const result = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        status, 
        balance::text, 
        score, 
        referral_code, 
        membership_type, 
        pix_key,
        created_at,
        two_factor_enabled,
        panic_phrase,
        secret_phrase,
        safe_contact_phone
      FROM users 
      WHERE email = $1 OR role = 'ADMIN'
      LIMIT 1
    `, [adminEmail]);

        if (result.rows.length === 0) {
            console.log("Nenhum administrador encontrado.");
            return;
        }

        const admin = result.rows[0];

        // Buscar também estatísticas de indicação diretas dele se houver
        const referrals = await pool.query('SELECT COUNT(*) FROM users WHERE referred_by = $1', [admin.id]);
        admin.total_referrals = referrals.rows[0].count;

        console.log(JSON.stringify(admin, null, 2));
    } catch (err) {
        console.error("Erro ao buscar dados do admin:", err);
    } finally {
        await pool.end();
    }
}

getIndividualAdminData();
