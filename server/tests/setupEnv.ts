process.env.NODE_ENV = "test";
process.env.PORT = "4001";
process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test_db";
process.env.JWT_SECRET = "test_secret_for_jwt_signing_1234567890";
process.env.JWT_EXPIRES_IN = "8h";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.PORTAL_BASE_URL = "http://localhost:5173";
process.env.UPLOAD_DIR = "uploads";
process.env.ENABLE_OPENAI_ASSIST = "false";

