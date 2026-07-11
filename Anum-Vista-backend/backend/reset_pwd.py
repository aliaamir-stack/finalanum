from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:postgres@localhost:5432/anum_vista_db', isolation_level='AUTOCOMMIT')
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER USER postgres PASSWORD 'admin';"))
    print('Password changed to admin successfully!')
except Exception as e:
    print('Failed to change password:', e)
